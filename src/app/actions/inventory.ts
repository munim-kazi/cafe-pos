"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createJournalEntry } from "@/lib/accounting/engine";
import { wasteEntry, stockAdjustment, cogsEntry } from "@/lib/accounting/templates";
import type { ActionResponse } from "@/types";
import type { Ingredient, Recipe, StockMovement } from "@/generated/prisma/client";

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function getAccountIdsByCode(
  codes: string[]
): Promise<Map<string, string>> {
  const accounts = await db.account.findMany({
    where: { code: { in: codes } },
    select: { code: true, id: true },
  });
  return new Map(accounts.map((a) => [a.code, a.id]));
}

// ─── Ingredient CRUD ─────────────────────────────────────────────────────────

interface IngredientFilters {
  search?: string;
  lowStock?: boolean;
  active?: boolean;
}

export async function getIngredients(
  params: IngredientFilters = {}
): Promise<ActionResponse<{ ingredients: Ingredient[]; count: number }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const where: Record<string, unknown> = {};

    if (params.search) {
      where.name = { contains: params.search, mode: "insensitive" };
    }

    if (params.active !== undefined) {
      where.active = params.active;
    }

    if (params.lowStock) {
      where.lowStockThreshold = { gte: db.ingredient.fields.currentStock };
    }

    const ingredients = await db.ingredient.findMany({
      where,
      orderBy: { name: "asc" },
    });

    let filtered = ingredients;

    if (params.lowStock) {
      filtered = ingredients.filter(
        (i) => Number(i.currentStock) <= Number(i.lowStockThreshold)
      );
    }

    return { success: true, data: { ingredients: filtered, count: filtered.length } };
  } catch (error) {
    console.error("getIngredients error:", error);
    return { success: false, error: "Failed to fetch ingredients" };
  }
}

export async function getIngredient(
  id: string
): Promise<ActionResponse<Ingredient & { recipeItems: Recipe[]; stockMovements: StockMovement[] }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const ingredient = await db.ingredient.findUnique({
      where: { id },
      include: {
        recipeItems: true,
        stockMovements: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!ingredient) return { success: false, error: "Ingredient not found" };

    return { success: true, data: ingredient };
  } catch (error) {
    console.error("getIngredient error:", error);
    return { success: false, error: "Failed to fetch ingredient" };
  }
}

interface CreateIngredientInput {
  name: string;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
  costPerUnit: number;
}

export async function createIngredient(
  data: CreateIngredientInput
): Promise<ActionResponse<Ingredient>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return { success: false, error: "Forbidden: admin or manager role required" };
    }

    if (!data.name || data.name.trim().length === 0) {
      return { success: false, error: "Name is required" };
    }
    if (!data.unit || data.unit.trim().length === 0) {
      return { success: false, error: "Unit is required" };
    }
    if (data.currentStock < 0) {
      return { success: false, error: "Current stock must be non-negative" };
    }
    if (data.lowStockThreshold < 0) {
      return { success: false, error: "Low stock threshold must be non-negative" };
    }
    if (data.costPerUnit < 0) {
      return { success: false, error: "Cost per unit must be non-negative" };
    }

    const existing = await db.ingredient.findUnique({
      where: { name: data.name.trim() },
    });
    if (existing) {
      return { success: false, error: "Ingredient name already exists" };
    }

    const ingredient = await db.ingredient.create({
      data: {
        name: data.name.trim(),
        unit: data.unit.trim(),
        currentStock: data.currentStock,
        lowStockThreshold: data.lowStockThreshold,
        costPerUnit: data.costPerUnit,
      },
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "Ingredient",
        entityId: ingredient.id,
        newValues: ingredient,
      },
    });

    return { success: true, data: ingredient };
  } catch (error) {
    console.error("createIngredient error:", error);
    return { success: false, error: "Failed to create ingredient" };
  }
}

interface UpdateIngredientInput {
  name?: string;
  unit?: string;
  lowStockThreshold?: number;
  costPerUnit?: number;
  active?: boolean;
}

export async function updateIngredient(
  id: string,
  data: UpdateIngredientInput
): Promise<ActionResponse<Ingredient>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return { success: false, error: "Forbidden: admin or manager role required" };
    }

    const existing = await db.ingredient.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Ingredient not found" };

    if (data.name !== undefined) {
      if (data.name.trim().length === 0) {
        return { success: false, error: "Name cannot be empty" };
      }
      const nameConflict = await db.ingredient.findFirst({
        where: { name: data.name.trim(), NOT: { id } },
      });
      if (nameConflict) {
        return { success: false, error: "Ingredient name already exists" };
      }
    }

    if (data.unit !== undefined && data.unit.trim().length === 0) {
      return { success: false, error: "Unit cannot be empty" };
    }
    if (data.lowStockThreshold !== undefined && data.lowStockThreshold < 0) {
      return { success: false, error: "Low stock threshold must be non-negative" };
    }
    if (data.costPerUnit !== undefined && data.costPerUnit < 0) {
      return { success: false, error: "Cost per unit must be non-negative" };
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.unit !== undefined) updateData.unit = data.unit.trim();
    if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = data.lowStockThreshold;
    if (data.costPerUnit !== undefined) updateData.costPerUnit = data.costPerUnit;
    if (data.active !== undefined) updateData.active = data.active;

    const ingredient = await db.ingredient.update({
      where: { id },
      data: updateData,
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Ingredient",
        entityId: id,
        oldValues: existing,
        newValues: ingredient,
      },
    });

    return { success: true, data: ingredient };
  } catch (error) {
    console.error("updateIngredient error:", error);
    return { success: false, error: "Failed to update ingredient" };
  }
}

interface AdjustStockInput {
  type: "ADJUSTMENT" | "WASTE" | "USAGE";
  quantity: number;
  notes?: string;
}

export async function adjustStock(
  ingredientId: string,
  data: AdjustStockInput
): Promise<ActionResponse<StockMovement>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return { success: false, error: "Forbidden: admin or manager role required" };
    }

    const ingredient = await db.ingredient.findUnique({ where: { id: ingredientId } });
    if (!ingredient) return { success: false, error: "Ingredient not found" };

    if (data.quantity <= 0) {
      return { success: false, error: "Quantity must be positive" };
    }

    const currentStock = Number(ingredient.currentStock);
    const quantity = data.quantity;
    let newStock: number;

    if (data.type === "USAGE" || data.type === "WASTE") {
      newStock = currentStock - quantity;
    } else {
      newStock = currentStock + quantity;
    }

    if (newStock < 0) {
      return {
        success: false,
        error: "Insufficient stock: current stock is " + currentStock + " " + ingredient.unit,
      };
    }

    const movementCost = quantity * Number(ingredient.costPerUnit);

    const movement = await db.$transaction(async (tx: TransactionClient) => {
      await tx.ingredient.update({
        where: { id: ingredientId },
        data: { currentStock: newStock },
      });

      const stockMovement = await tx.stockMovement.create({
        data: {
          ingredientId,
          type: data.type,
          quantity,
          unitCost: ingredient.costPerUnit,
          notes: data.notes ?? null,
        },
      });

      return stockMovement;
    });

    try {
      const accountCodes = ["1200", "5000", "5500"];
      const accountIds = await getAccountIdsByCode(accountCodes);
      const inventoryAccountId = accountIds.get("1200");
      const cogsAccountId = accountIds.get("5000");
      const wasteLossAccountId = accountIds.get("5500");

      if (inventoryAccountId) {
        let lines;

        if (data.type === "USAGE" && cogsAccountId) {
          lines = cogsEntry(movementCost);
        } else if (data.type === "WASTE" && wasteLossAccountId) {
          lines = wasteEntry(movementCost);
        } else if (data.type === "ADJUSTMENT") {
          lines = stockAdjustment(movementCost);
        }

        if (lines) {
          await createJournalEntry({
            description: "Stock " + data.type.toLowerCase() + ": " + ingredient.name,
            referenceType: "StockMovement",
            referenceId: movement.id,
            userId: session.user.id,
            lines,
          });
        }
      }
    } catch (accountingError) {
      console.error("Failed to create accounting entry for stock adjustment:", accountingError);
    }

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Ingredient",
        entityId: ingredientId,
        oldValues: { currentStock: ingredient.currentStock },
        newValues: { currentStock: newStock, stockMovementId: movement.id },
      },
    });

    return { success: true, data: movement };
  } catch (error) {
    console.error("adjustStock error:", error);
    return { success: false, error: "Failed to adjust stock" };
  }
}

// ─── Recipe CRUD ─────────────────────────────────────────────────────────────

export async function getRecipes(
  menuItemId?: string
): Promise<ActionResponse<Recipe[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const where: Record<string, unknown> = {};
    if (menuItemId) {
      where.menuItemId = menuItemId;
    }

    const recipes = await db.recipe.findMany({
      where,
      include: { ingredient: true },
      orderBy: { id: "asc" },
    });

    return { success: true, data: recipes };
  } catch (error) {
    console.error("getRecipes error:", error);
    return { success: false, error: "Failed to fetch recipes" };
  }
}

export async function getRecipesByMenuItem(
  menuItemId: string
): Promise<ActionResponse<Recipe[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const recipes = await db.recipe.findMany({
      where: { menuItemId },
      include: { ingredient: true },
      orderBy: { id: "asc" },
    });

    return { success: true, data: recipes };
  } catch (error) {
    console.error("getRecipesByMenuItem error:", error);
    return { success: false, error: "Failed to fetch recipes for menu item" };
  }
}

interface RecipeInput {
  ingredientId: string;
  quantity: number;
}

export async function saveRecipes(
  menuItemId: string,
  recipes: RecipeInput[]
): Promise<ActionResponse<Recipe[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return { success: false, error: "Forbidden: admin or manager role required" };
    }

    const menuItem = await db.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) return { success: false, error: "Menu item not found" };

    for (const recipe of recipes) {
      if (recipe.quantity <= 0) {
        return { success: false, error: "Recipe quantity must be positive for ingredient " + recipe.ingredientId };
      }
    }

    for (const recipe of recipes) {
      const ingredient = await db.ingredient.findUnique({
        where: { id: recipe.ingredientId },
      });
      if (!ingredient) {
        return { success: false, error: "Ingredient not found: " + recipe.ingredientId };
      }
    }

    const createdRecipes = await db.$transaction(async (tx: TransactionClient) => {
      await tx.recipe.deleteMany({ where: { menuItemId } });

      const created: Recipe[] = [];
      for (const recipe of recipes) {
        const r = await tx.recipe.create({
          data: {
            menuItemId,
            ingredientId: recipe.ingredientId,
            quantity: recipe.quantity,
          },
        });
        created.push(r);
      }

      return created;
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Recipe",
        entityId: menuItemId,
        newValues: { recipes: createdRecipes },
      },
    });

    return { success: true, data: createdRecipes };
  } catch (error) {
    console.error("saveRecipes error:", error);
    return { success: false, error: "Failed to save recipes" };
  }
}

// ─── Low Stock ───────────────────────────────────────────────────────────────

export async function getLowStockIngredients(): Promise<ActionResponse<Ingredient[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    const ingredients = await db.ingredient.findMany({
      where: { active: true },
      orderBy: { currentStock: "asc" },
    });

    const lowStock = ingredients.filter(
      (i) => Number(i.currentStock) <= Number(i.lowStockThreshold)
    );

    return { success: true, data: lowStock };
  } catch (error) {
    console.error("getLowStockIngredients error:", error);
    return { success: false, error: "Failed to fetch low stock ingredients" };
  }
}
