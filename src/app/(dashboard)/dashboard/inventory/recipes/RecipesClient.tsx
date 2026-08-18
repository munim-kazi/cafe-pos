"use client";

import { useState, useCallback } from "react";
import { saveRecipes } from "@/app/actions/inventory";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Recipe, Ingredient, MenuItem } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

interface Props {
  initialRecipes: Recipe[];
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  userRole: Role;
}

interface Toast {
  message: string;
  type: "success" | "error";
}

interface RecipeRow {
  ingredientId: string;
  quantity: string;
}

export default function RecipesClient({
  initialRecipes,
  menuItems,
  ingredients,
  userRole,
}: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes);
  const [menuFilter, setMenuFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMenuItemId, setEditingMenuItemId] = useState<string>("");
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const canManage = userRole === "ADMIN" || userRole === "MANAGER";

  const showToast = useCallback((message: string, type: Toast["type"]) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const filteredRecipes = menuFilter
    ? recipes.filter((r) => r.menuItemId === menuFilter)
    : recipes;

  const groupedByMenuItem = filteredRecipes.reduce<
    Record<string, Recipe[]>
  >((acc, r) => {
    if (!acc[r.menuItemId]) acc[r.menuItemId] = [];
    acc[r.menuItemId].push(r);
    return acc;
  }, {});

  const getMenuItemName = (id: string) =>
    menuItems.find((m) => m.id === id)?.name ?? "Unknown";

  const getIngredientName = (id: string) =>
    ingredients.find((i) => i.id === id)?.name ?? "Unknown";

  const getIngredientUnit = (id: string) =>
    ingredients.find((i) => i.id === id)?.unit ?? "";

  const openEditRecipe = (menuItemId: string) => {
    setEditingMenuItemId(menuItemId);
    const existing = recipes
      .filter((r) => r.menuItemId === menuItemId)
      .map((r) => ({
        ingredientId: r.ingredientId,
        quantity: r.quantity.toString(),
      }));
    setRecipeRows(
      existing.length > 0 ? existing : [{ ingredientId: "", quantity: "" }]
    );
    setModalOpen(true);
  };

  const addRow = () => {
    setRecipeRows((rows) => [...rows, { ingredientId: "", quantity: "" }]);
  };

  const removeRow = (index: number) => {
    setRecipeRows((rows) => rows.filter((_, i) => i !== index));
  };

  const updateRow = (
    index: number,
    field: keyof RecipeRow,
    value: string
  ) => {
    setRecipeRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const handleSave = async () => {
    const valid = recipeRows.filter(
      (r) => r.ingredientId && parseFloat(r.quantity) > 0
    );
    if (valid.length === 0) {
      showToast("Add at least one ingredient with a positive quantity", "error");
      return;
    }

    setSubmitting(true);
    try {
      const result = await saveRecipes(
        editingMenuItemId,
        valid.map((r) => ({
          ingredientId: r.ingredientId,
          quantity: parseFloat(r.quantity),
        }))
      );
      if (result.success) {
        const updated = result.data ?? [];
        setRecipes((prev) => {
          const others = prev.filter(
            (r) => r.menuItemId !== editingMenuItemId
          );
          return [...others, ...updated];
        });
        showToast("Recipe saved", "success");
        setModalOpen(false);
      } else {
        showToast(result.error ?? "Failed to save recipe", "error");
      }
    } catch {
      showToast("An unexpected error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const toastClass =
    "fixed right-4 top-4 z-50 rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg " +
    (toast?.type === "success" ? "bg-green-600" : "bg-red-600");

  const menuItemsWithRecipes = Array.from(
    new Set(recipes.map((r) => r.menuItemId))
  );

  const displayMenuIds = menuFilter
    ? [menuFilter]
    : menuItemsWithRecipes.length > 0
      ? menuItemsWithRecipes
      : [];

  return (
    <div>
      {toast && <div className={toastClass}>{toast.message}</div>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Define which ingredients are needed for each menu item.
          </p>
        </div>
        {canManage && menuItems.length > 0 && (
          <button
            onClick={() => openEditRecipe(menuItems[0].id)}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Edit Recipe
          </button>
        )}
      </div>

      <div className="mt-4 w-full sm:w-64">
        <select
          value={menuFilter}
          onChange={(e) => setMenuFilter(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="">All Menu Items</option>
          {menuItems.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {recipes.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No recipes yet"
            description="Define recipes by assigning ingredients to menu items."
          />
        </div>
      ) : displayMenuIds.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No recipes match your filter"
            description="Try selecting a different menu item."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {displayMenuIds.map((menuItemId) => {
            const items = groupedByMenuItem[menuItemId] ?? [];
            return (
              <div
                key={menuItemId}
                className="rounded-lg border border-gray-200 bg-white"
              >
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                  <h2 className="text-base font-semibold text-gray-900">
                    {getMenuItemName(menuItemId)}
                  </h2>
                  {canManage && (
                    <button
                      onClick={() => openEditRecipe(menuItemId)}
                      className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit Recipe
                    </button>
                  )}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Ingredient
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Quantity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Unit
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {items.map((recipe) => (
                        <tr key={recipe.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                            {getIngredientName(recipe.ingredientId)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                            {recipe.quantity.toString()}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                            {getIngredientUnit(recipe.ingredientId)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="divide-y divide-gray-200 md:hidden">
                  {items.map((recipe) => (
                    <div key={recipe.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">
                          {getIngredientName(recipe.ingredientId)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {recipe.quantity.toString()} {getIngredientUnit(recipe.ingredientId)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Recipe Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          "Edit Recipe \u2014 " + getMenuItemName(editingMenuItemId)
        }
      >
        <div className="space-y-4">
          {!menuFilter && (
            <div>
              <label
                htmlFor="recipe-menu"
                className="block text-sm font-medium text-gray-700"
              >
                Menu Item
              </label>
              <select
                id="recipe-menu"
                value={editingMenuItemId}
                onChange={(e) => {
                  setEditingMenuItemId(e.target.value);
                  const existing = recipes
                    .filter((r) => r.menuItemId === e.target.value)
                    .map((r) => ({
                      ingredientId: r.ingredientId,
                      quantity: r.quantity.toString(),
                    }));
                  setRecipeRows(
                    existing.length > 0
                      ? existing
                      : [{ ingredientId: "", quantity: "" }]
                  );
                }}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select menu item</option>
                {menuItems.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">
                Ingredients
              </h3>
              <button
                type="button"
                onClick={addRow}
                className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                + Add Row
              </button>
            </div>

            {recipeRows.length === 0 ? (
              <p className="mt-2 text-xs text-gray-500">
                No ingredients added yet.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {recipeRows.map((row, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-md border border-gray-200 p-3"
                  >
                    <div className="flex-1 space-y-2">
                      <select
                        value={row.ingredientId}
                        onChange={(e) =>
                          updateRow(idx, "ingredientId", e.target.value)
                        }
                        className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Select ingredient</option>
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({ing.unit})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0.001}
                        step={0.001}
                        value={row.quantity}
                        onChange={(e) =>
                          updateRow(idx, "quantity", e.target.value)
                        }
                        placeholder="Quantity"
                        className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setModalOpen(false)}
            disabled={submitting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting || !editingMenuItemId}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Recipe"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
