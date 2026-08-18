"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createOrder, processPayment } from "@/app/actions/orders";
import { formatCurrency, cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { printReceipt, type ReceiptData } from "@/lib/hardware/receipt-printer";


// ─── Types ────────────────────────────────────────────────────────────────────

type MenuItemWithRelations = {
  id: string;
  name: string;
  description: string | null;
  basePrice: { toString(): string };
  available: boolean;
  categoryId: string;
  category: { id: string; name: string };
  variants: {
    id: string;
    name: string;
    priceAdjust: { toString(): string };
    available: boolean;
    addons: {
      addon: {
        id: string;
        name: string;
        price: { toString(): string };
        available: boolean;
      };
    }[];
  }[];
};

type TableWithRelations = {
  id: string;
  number: number;
  capacity: number;
  status: string;
  section: string | null;
};

type Category = { id: string; name: string; sortOrder: number; active: boolean };

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

interface CartItem {
  key: string;
  menuItemId: string;
  variantId?: string;
  variantName?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  addons: { addonId: string; name: string; price: number }[];
  notes?: string;
}

type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
type PaymentMethod = "CASH" | "CARD" | "MOBILE";

interface Props {
  menuItems: MenuItemWithRelations[];
  tables: TableWithRelations[];
  customers: Customer[];
  categories: Category[];
}

interface CreatedOrder {
  id: string;
  orderNumber: string;
  type: string;
  grandTotal: { toString(): string };
  subtotal: { toString(): string };
  taxAmount: { toString(): string };
  discountAmount: { toString(): string };
  taxRate: { toString(): string };
  paymentStatus: string;
  status: string;
  notes: string | null;
  items: {
    name: string;
    quantity: number;
    unitPrice: { toString(): string };
    subtotal: { toString(): string };
    addons: { name: string; price: { toString(): string } }[];
  }[];
  customer: { name: string } | null;
  table: { number: number } | null;
}

// ─── Variant Picker Modal ─────────────────────────────────────────────────────

function VariantPicker({
  item,
  onSelect,
  onClose,
}: {
  item: MenuItemWithRelations;
  onSelect: (variantId?: string, addons?: { addonId: string; name: string; price: number }[]) => void;
  onClose: () => void;
}) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>();
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());

  const variants = item.variants.filter((v) => v.available);
  const basePrice = Number(item.basePrice);

  const activeVariantId = selectedVariantId ?? null;

  const availableAddons = useMemo(() => {
    const v = variants.find((w) => w.id === activeVariantId);
    return v?.addons.filter((a) => a.addon.available) ?? [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVariantId]);

  const activeVariantAdjust = useMemo(() => {
    const v = variants.find((w) => w.id === activeVariantId);
    return v ? Number(v.priceAdjust) : 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVariantId]);

  const unitPrice = useMemo(() => {
    const addonTotal = availableAddons
      .filter((a) => selectedAddons.has(a.addon.id))
      .reduce((sum, a) => sum + Number(a.addon.price), 0);
    return basePrice + activeVariantAdjust + addonTotal;
  }, [basePrice, activeVariantAdjust, selectedAddons, availableAddons]);

  const toggleAddon = useCallback((addonId: string) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(addonId)) {
        next.delete(addonId);
      } else {
        next.add(addonId);
      }
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const addons = availableAddons
      .filter((a) => selectedAddons.has(a.addon.id))
      .map((a) => ({
        addonId: a.addon.id,
        name: a.addon.name,
        price: Number(a.addon.price),
      }));
    onSelect(selectedVariantId, addons);
  }, [selectedVariantId, selectedAddons, availableAddons, onSelect]);

  return (
    <Modal open={true} onClose={onClose} title={item.name}>
      <div className="space-y-4">
        {variants.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Select Variant</p>
            <div className="space-y-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setSelectedVariantId(v.id);
                    setSelectedAddons(new Set());
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                    selectedVariantId === v.id
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <span className="font-medium">{v.name}</span>
                  <span className="text-sm">
                    {formatCurrency(basePrice + Number(v.priceAdjust))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {availableAddons.length > 0 && selectedVariantId && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Add-ons (optional)</p>
            <div className="space-y-2">
              {availableAddons.map((a) => (
                <button
                  key={a.addon.id}
                  onClick={() => toggleAddon(a.addon.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                    selectedAddons.has(a.addon.id)
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <span className="font-medium">{a.addon.name}</span>
                  <span className="text-sm">+{formatCurrency(Number(a.addon.price))}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg bg-gray-100 px-4 py-3">
          <span className="text-sm text-gray-600">Unit Price</span>
          <span className="text-lg font-bold text-gray-900">{formatCurrency(unitPrice)}</span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={variants.length > 0 && !selectedVariantId}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg bg-red-600 px-6 py-3 text-sm font-medium text-white shadow-lg">
      {message}
    </div>
  );
}

// ─── Main POS Screen ─────────────────────────────────────────────────────────

export default function POSScreen({
  menuItems,
  tables,
  customers,
  categories,
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>("DINE_IN");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [orderNotes, setOrderNotes] = useState("");
  const [variantPickerItem, setVariantPickerItem] = useState<MenuItemWithRelations | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentReference, setPaymentReference] = useState("");

  const [placingOrder, setPlacingOrder] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [cartExpanded, setCartExpanded] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Close customer dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(e.target as Node)
      ) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  // ─── Filtering ────────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    let items = menuItems;
    if (selectedCategory) {
      items = items.filter((i) => i.categoryId === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }
    return items;
  }, [menuItems, selectedCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of menuItems) {
      counts[item.categoryId] = (counts[item.categoryId] || 0) + 1;
    }
    return counts;
  }, [menuItems]);

  const availableTables = useMemo(
    () => tables.filter((t) => t.status === "AVAILABLE"),
    [tables]
  );

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [customers, customerSearch]);

  // ─── Cart Helpers ──────────────────────────────────────────────────────────

  const addToCart = useCallback(
    (item: MenuItemWithRelations, variantId?: string, addons?: { addonId: string; name: string; price: number }[]) => {
      const basePrice = Number(item.basePrice);
      const variant = variantId
        ? item.variants.find((v) => v.id === variantId)
        : undefined;
      const variantAdjust = variant ? Number(variant.priceAdjust) : 0;
      const addonTotal = (addons ?? []).reduce((s, a) => s + a.price, 0);
      const unitPrice = basePrice + variantAdjust + addonTotal;

      const variantName = variant?.name;

      const key = [
        item.id,
        variantId ?? "none",
        (addons ?? [])
          .map((a) => a.addonId)
          .sort()
          .join(","),
      ].join(":");

      setCart((prev) => {
        const existing = prev.find((c) => c.key === key);
        if (existing) {
          return prev.map((c) =>
            c.key === key ? { ...c, quantity: c.quantity + 1 } : c
          );
        }
        return [
          ...prev,
          {
            key,
            menuItemId: item.id,
            variantId,
            variantName,
            name: item.name,
            quantity: 1,
            unitPrice,
            discount: 0,
            addons: addons ?? [],
            notes: undefined,
          },
        ];
      });
    },
    []
  );

  const handleAddItem = useCallback(
    (item: MenuItemWithRelations) => {
      if (!item.available) {
        showToast("This item is currently unavailable");
        return;
      }
      if (item.variants.length > 0) {
        setVariantPickerItem(item);
      } else {
        addToCart(item);
      }
    },
    [addToCart, showToast]
  );

  const updateQuantity = useCallback((key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.key === key ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c
        )
        .filter((c) => c.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setCart((prev) => prev.filter((c) => c.key !== key));
  }, []);

  const updateItemDiscount = useCallback((key: string, discount: number) => {
    setCart((prev) =>
      prev.map((c) => (c.key === key ? { ...c, discount: Math.max(0, discount) } : c))
    );
  }, []);

  const updateItemNotes = useCallback((key: string, notes: string) => {
    setCart((prev) =>
      prev.map((c) => (c.key === key ? { ...c, notes } : c))
    );
  }, []);

  // ─── Calculations ──────────────────────────────────────────────────────────

  const cartTotals = useMemo(() => {
    let subtotal = 0;
    let totalItemDiscount = 0;
    for (const item of cart) {
      subtotal += item.unitPrice * item.quantity;
      totalItemDiscount += item.discount;
    }
    const afterItemDiscount = subtotal - totalItemDiscount;
    const afterOrderDiscount = afterItemDiscount - orderDiscount;
    const taxAmount = afterOrderDiscount * (taxRate / 100);
    const grandTotal = afterOrderDiscount + taxAmount;
    return { subtotal, totalItemDiscount, afterItemDiscount, taxAmount, grandTotal: Math.max(0, grandTotal) };
  }, [cart, orderDiscount, taxRate]);

  // ─── Place Order ───────────────────────────────────────────────────────────

  const handlePlaceOrder = useCallback(async () => {
    if (cart.length === 0) {
      showToast("Cart is empty");
      return;
    }
    if (orderType === "DINE_IN" && !selectedTable) {
      showToast("Please select a table for dine-in orders");
      return;
    }

    setPlacingOrder(true);
    try {
      const result = await createOrder({
        type: orderType,
        tableId: orderType === "DINE_IN" ? selectedTable ?? undefined : undefined,
        customerId: selectedCustomer ?? undefined,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          variantId: c.variantId,
          name: c.variantName ? c.name + " (" + c.variantName + ")" : c.name,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          discount: c.discount,
          addons: c.addons.map((a) => ({
            addonId: a.addonId,
            name: a.name,
            price: a.price,
          })),
          notes: c.notes,
        })),
        discountAmount: orderDiscount,
        taxRate,
        notes: orderNotes || undefined,
      });

      if (!result.success) {
        showToast(result.error ?? "Failed to create order");
        return;
      }

      const orderData = result.data as unknown as CreatedOrder;
      setCreatedOrder(orderData);
      setPaymentAmount(Number(orderData.grandTotal));
      setShowPaymentModal(true);
    } catch {
      showToast("An unexpected error occurred");
    } finally {
      setPlacingOrder(false);
    }
  }, [cart, orderType, selectedTable, selectedCustomer, orderDiscount, taxRate, orderNotes, showToast]);

  // ─── Process Payment ───────────────────────────────────────────────────────

  const handleProcessPayment = useCallback(async () => {
    if (!createdOrder) return;
    if (paymentAmount <= 0) {
      showToast("Payment amount must be greater than zero");
      return;
    }

    setProcessingPayment(true);
    try {
      const result = await processPayment({
        orderId: createdOrder.id,
        method: paymentMethod,
        amount: paymentAmount,
        reference: paymentReference || undefined,
      });

      if (!result.success) {
        showToast(result.error ?? "Payment failed");
        return;
      }

      setShowPaymentModal(false);
      setShowReceiptModal(true);
    } catch {
      showToast("An unexpected error occurred during payment");
    } finally {
      setProcessingPayment(false);
    }
  }, [createdOrder, paymentMethod, paymentAmount, paymentReference, showToast]);

  // ─── Skip Payment ──────────────────────────────────────────────────────────

  const handleSkipPayment = useCallback(() => {
    setShowPaymentModal(false);
    setShowReceiptModal(true);
  }, []);

  // ─── Reset After Receipt ──────────────────────────────────────────────────

  const handleReceiptClose = useCallback(() => {
    setShowReceiptModal(false);
    setCreatedOrder(null);
    setCart([]);
    setSelectedTable(null);
    setSelectedCustomer(null);
    setOrderDiscount(0);
    setTaxRate(0);
    setOrderNotes("");
    setPaymentMethod("CASH");
    setPaymentAmount(0);
    setPaymentReference("");
    setCustomerSearch("");
  }, []);

  // ─── Print Receipt ─────────────────────────────────────────────────────────

  const handlePrint = useCallback(() => {
    if (!createdOrder) return;

    const tableNum = createdOrder.table
      ? String(createdOrder.table.number)
      : undefined;

    const receiptData: ReceiptData = {
      cafeName: "Cafe POS",
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      orderType: createdOrder.type,
      tableNumber: tableNum,
      cashierName: "Staff",
      items: createdOrder.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.subtotal),
        addons: item.addons.map((a) => a.name),
      })),
      subtotal: Number(createdOrder.subtotal),
      taxRate: Number(createdOrder.taxRate) || undefined,
      taxAmount: Number(createdOrder.taxAmount) || undefined,
      discountAmount: Number(createdOrder.discountAmount) || undefined,
      grandTotal: Number(createdOrder.grandTotal),
      payments: [
        {
          method: paymentMethod,
          amount: paymentAmount,
        },
      ],
      change:
        paymentMethod === "CASH"
          ? Math.max(0, paymentAmount - Number(createdOrder.grandTotal))
          : undefined,
      date: new Date().toLocaleString("en-BD", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    printReceipt(receiptData);
  }, [createdOrder, paymentMethod, paymentAmount]);

  // ─── Quick Cash Denominations ──────────────────────────────────────────────

  const quickCashAmounts = [50, 100, 200, 500, 1000];
  const changeDue = paymentMethod === "CASH" ? paymentAmount - cartTotals.grandTotal : 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-gray-50 lg:flex-row">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* ─── Left: Categories + Product Grid ──────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Search bar */}
        <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {/* Mobile cart toggle */}
          <button
            onClick={() => setCartExpanded(true)}
            className="relative rounded-lg bg-indigo-600 p-2.5 text-white lg:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
              />
            </svg>
            {cart.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {cart.reduce((s, c) => s + c.quantity, 0)}
              </span>
            )}
          </button>
        </div>

        {/* Categories - horizontal scroll */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-gray-200 bg-white px-4 py-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
              !selectedCategory
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            All ({menuItems.length})
          </button>
          {categories
            .filter((c) => c.active)
            .map((cat) => (
              <button
                key={cat.id}
                onClick={() =>
                  setSelectedCategory(selectedCategory === cat.id ? null : cat.id)
                }
                className={cn(
                  "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  selectedCategory === cat.id
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                {cat.name} ({categoryCounts[cat.id] ?? 0})
              </button>
            ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredItems.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-500">
              <div className="text-center">
                <svg
                  className="mx-auto mb-3 h-12 w-12 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                <p className="text-sm font-medium">No items found</p>
                <p className="mt-1 text-xs text-gray-400">
                  Try a different search or category
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleAddItem(item)}
                  disabled={!item.available}
                  className="flex flex-col rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-all hover:border-indigo-300 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="mb-1 text-xs font-medium text-indigo-600">
                    {item.category.name}
                  </span>
                  <span className="mb-auto line-clamp-2 text-sm font-semibold text-gray-900">
                    {item.name}
                  </span>
                  {item.description && (
                    <span className="mt-1 line-clamp-1 text-xs text-gray-500">
                      {item.description}
                    </span>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">
                      {formatCurrency(Number(item.basePrice))}
                    </span>
                    {item.variants.length > 0 && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                        {item.variants.length} options
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Right: Cart Panel (Desktop) ─────────────────────────────────── */}
      <div className="hidden w-[380px] flex-shrink-0 border-l border-gray-200 bg-white lg:flex lg:flex-col">
        <CartPanel
          cart={cart}
          orderType={orderType}
          selectedTable={selectedTable}
          selectedCustomer={selectedCustomer}
          orderDiscount={orderDiscount}
          taxRate={taxRate}
          orderNotes={orderNotes}
          tables={availableTables}
          customers={filteredCustomers}
          customerSearch={customerSearch}
          customerDropdownRef={customerDropdownRef}
          cartTotals={cartTotals}
          placingOrder={placingOrder}
          onOrderTypeChange={setOrderType}
          onTableChange={setSelectedTable}
          onCustomerChange={setSelectedCustomer}
          onCustomerSearchChange={setCustomerSearch}
          onShowCustomerDropdown={setShowCustomerDropdown}
          showCustomerDropdown={showCustomerDropdown}
          onOrderDiscountChange={setOrderDiscount}
          onTaxRateChange={setTaxRate}
          onOrderNotesChange={setOrderNotes}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
          onUpdateItemDiscount={updateItemDiscount}
          onUpdateItemNotes={updateItemNotes}
          onPlaceOrder={handlePlaceOrder}
        />
      </div>

      {/* ─── Mobile Cart Overlay ─────────────────────────────────────────── */}
      {cartExpanded && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden">
          <div className="absolute inset-x-0 bottom-0 top-12 flex flex-col rounded-t-2xl bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Cart ({cart.reduce((s, c) => s + c.quantity, 0)} items)
              </h3>
              <button
                onClick={() => setCartExpanded(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CartPanel
                cart={cart}
                orderType={orderType}
                selectedTable={selectedTable}
                selectedCustomer={selectedCustomer}
                orderDiscount={orderDiscount}
                taxRate={taxRate}
                orderNotes={orderNotes}
                tables={availableTables}
                customers={filteredCustomers}
                customerSearch={customerSearch}
                customerDropdownRef={customerDropdownRef}
                cartTotals={cartTotals}
                placingOrder={placingOrder}
                onOrderTypeChange={setOrderType}
                onTableChange={setSelectedTable}
                onCustomerChange={setSelectedCustomer}
                onCustomerSearchChange={setCustomerSearch}
                onShowCustomerDropdown={setShowCustomerDropdown}
                showCustomerDropdown={showCustomerDropdown}
                onOrderDiscountChange={setOrderDiscount}
                onTaxRateChange={setTaxRate}
                onOrderNotesChange={setOrderNotes}
                onUpdateQuantity={updateQuantity}
                onRemoveItem={removeItem}
                onUpdateItemDiscount={updateItemDiscount}
                onUpdateItemNotes={updateItemNotes}
                onPlaceOrder={handlePlaceOrder}
                isMobile
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Variant Picker Modal ────────────────────────────────────────── */}
      {variantPickerItem && (
        <VariantPicker
          item={variantPickerItem}
          onSelect={(variantId, addons) => {
            addToCart(variantPickerItem, variantId, addons);
            setVariantPickerItem(null);
          }}
          onClose={() => setVariantPickerItem(null)}
        />
      )}

      {/* ─── Payment Modal ───────────────────────────────────────────────── */}
      <Modal
        open={showPaymentModal}
        onClose={() => !processingPayment && setShowPaymentModal(false)}
        title="Process Payment"
      >
        <div className="space-y-4">
          {createdOrder && (
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <p className="text-sm text-gray-600">Order Total</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(Number(createdOrder.grandTotal))}
              </p>
              <p className="mt-1 text-xs text-gray-500">{createdOrder.orderNumber}</p>
            </div>
          )}

          {/* Payment Method */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {(["CASH", "CARD", "MOBILE"] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  onClick={() => {
                    setPaymentMethod(method);
                    if (method === "CASH" && createdOrder) {
                      setPaymentAmount(Number(createdOrder.grandTotal));
                    }
                  }}
                  className={cn(
                    "rounded-lg border-2 px-3 py-3 text-sm font-medium transition-colors",
                    paymentMethod === method
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  )}
                >
                  {method === "CASH" && "💵 "}
                  {method === "CARD" && "💳 "}
                  {method === "MOBILE" && "📱 "}
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Amount Received
            </label>
            <input
              type="number"
              value={paymentAmount || ""}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              min={0}
              step={0.01}
            />
          </div>

          {/* Quick cash buttons for CASH method */}
          {paymentMethod === "CASH" && (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">Quick Amount</p>
              <div className="flex flex-wrap gap-2">
                {quickCashAmounts.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setPaymentAmount(amt)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {formatCurrency(amt)}
                  </button>
                ))}
                {createdOrder && (
                  <button
                    onClick={() => setPaymentAmount(Number(createdOrder.grandTotal))}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    Exact
                  </button>
                )}
              </div>
              {changeDue > 0 && (
                <div className="mt-2 rounded-lg bg-green-50 p-3 text-center">
                  <p className="text-xs text-green-600">Change Due</p>
                  <p className="text-lg font-bold text-green-700">
                    {formatCurrency(changeDue)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Reference for CARD/MOBILE */}
          {paymentMethod !== "CASH" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Reference / Transaction ID
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSkipPayment}
              disabled={processingPayment}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Pay Later
            </button>
            <button
              onClick={handleProcessPayment}
              disabled={processingPayment || paymentAmount <= 0}
              className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processingPayment ? "Processing..." : "Confirm Payment"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Receipt Modal ───────────────────────────────────────────────── */}
      <Modal
        open={showReceiptModal}
        onClose={handleReceiptClose}
        title="Order Placed"
      >
        <div className="space-y-4">
          {createdOrder && (
            <div className="receipt-content">
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
                <div className="mb-3 text-center">
                  <p className="text-xs text-gray-500">Order Number</p>
                  <p className="text-lg font-bold text-gray-900">
                    {createdOrder.orderNumber}
                  </p>
                  <p className="text-xs capitalize text-gray-500">
                    {createdOrder.type.replace("_", " ").toLowerCase()}
                    {createdOrder.table && " • Table " + createdOrder.table.number}
                  </p>
                </div>

                <div className="space-y-2 border-t border-gray-200 pt-3">
                  {createdOrder.items.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-900">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(Number(item.subtotal))}
                        </span>
                      </div>
                      {item.addons.length > 0 && (
                        <div className="ml-4 text-xs text-gray-500">
                          {item.addons.map((a) => a.name).join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 space-y-1 border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(Number(createdOrder.subtotal))}</span>
                  </div>
                  {Number(createdOrder.discountAmount) > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(Number(createdOrder.discountAmount))}</span>
                    </div>
                  )}
                  {Number(createdOrder.taxAmount) > 0 && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Tax ({Number(createdOrder.taxRate)}%)</span>
                      <span>{formatCurrency(Number(createdOrder.taxAmount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                    <span>Total</span>
                    <span>{formatCurrency(Number(createdOrder.grandTotal))}</span>
                  </div>
                </div>

                <div className="mt-3 border-t border-gray-200 pt-3 text-center">
                  <p className="text-xs text-gray-500">
                    Status:{" "}
                    <span
                      className={cn(
                        "font-medium",
                        createdOrder.paymentStatus === "PAID"
                          ? "text-green-600"
                          : "text-yellow-600"
                      )}
                    >
                      {createdOrder.paymentStatus}
                    </span>
                  </p>
                  {createdOrder.customer && (
                    <p className="text-xs text-gray-500">
                      Customer: {createdOrder.customer.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Print Receipt
            </button>
            <button
              onClick={handleReceiptClose}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700"
            >
              New Order
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Cart Panel Component ──────────────────────────────────────────────────────

function CartPanel({
  cart,
  orderType,
  selectedTable,
  selectedCustomer,
  orderDiscount,
  taxRate,
  orderNotes,
  tables,
  customers,
  customerSearch,
  customerDropdownRef,
  cartTotals,
  placingOrder,
  onOrderTypeChange,
  onTableChange,
  onCustomerChange,
  onCustomerSearchChange,
  onShowCustomerDropdown,
  showCustomerDropdown,
  onOrderDiscountChange,
  onTaxRateChange,
  onOrderNotesChange,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateItemDiscount,
  onUpdateItemNotes,
  onPlaceOrder,
  isMobile = false,
}: {
  cart: CartItem[];
  orderType: OrderType;
  selectedTable: string | null;
  selectedCustomer: string | null;
  orderDiscount: number;
  taxRate: number;
  orderNotes: string;
  tables: TableWithRelations[];
  customers: Customer[];
  customerSearch: string;
  customerDropdownRef: React.RefObject<HTMLDivElement | null>;
  cartTotals: {
    subtotal: number;
    totalItemDiscount: number;
    afterItemDiscount: number;
    taxAmount: number;
    grandTotal: number;
  };
  placingOrder: boolean;
  onOrderTypeChange: (type: OrderType) => void;
  onTableChange: (id: string | null) => void;
  onCustomerChange: (id: string | null) => void;
  onCustomerSearchChange: (search: string) => void;
  onShowCustomerDropdown: (show: boolean) => void;
  showCustomerDropdown: boolean;
  onOrderDiscountChange: (amount: number) => void;
  onTaxRateChange: (rate: number) => void;
  onOrderNotesChange: (notes: string) => void;
  onUpdateQuantity: (key: string, delta: number) => void;
  onRemoveItem: (key: string) => void;
  onUpdateItemDiscount: (key: string, discount: number) => void;
  onUpdateItemNotes: (key: string, notes: string) => void;
  onPlaceOrder: () => void;
  isMobile?: boolean;
}) {
  const selectedCustomerObj = customers.find((c) => c.id === selectedCustomer);

  return (
    <div className={cn("flex flex-col", isMobile ? "h-full" : "h-full")}>
      {/* Order Type Selector */}
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex gap-2">
          {(["DINE_IN", "TAKEAWAY", "DELIVERY"] as OrderType[]).map((type) => (
            <button
              key={type}
              onClick={() => {
                onOrderTypeChange(type);
                if (type !== "DINE_IN") onTableChange(null);
              }}
              className={cn(
                "flex-1 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors",
                orderType === type
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {type === "DINE_IN" && "🍽️ "}
              {type === "TAKEAWAY" && "📦 "}
              {type === "DELIVERY" && "🚗 "}
              {type.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Table selector (only for DINE_IN) */}
      {orderType === "DINE_IN" && (
        <div className="border-b border-gray-200 px-4 py-3">
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Select Table
          </label>
          <select
            value={selectedTable ?? ""}
            onChange={(e) => onTableChange(e.target.value || null)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Choose a table...</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                Table {t.number} ({t.capacity} seats)
                {t.section ? " - " + t.section : ""}
              </option>
            ))}
          </select>
          {tables.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">No available tables</p>
          )}
        </div>
      )}

      {/* Customer selector */}
      <div className="border-b border-gray-200 px-4 py-3" ref={customerDropdownRef}>
        <label className="mb-1 block text-xs font-medium text-gray-500">
          Customer (optional)
        </label>
        {selectedCustomerObj ? (
          <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
            <span className="text-sm font-medium text-indigo-800">
              {selectedCustomerObj.name}
              {selectedCustomerObj.phone && " (" + selectedCustomerObj.phone + ")"}
            </span>
            <button
              onClick={() => {
                onCustomerChange(null);
                onCustomerSearchChange("");
              }}
              className="rounded p-1 text-indigo-400 hover:text-indigo-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={customerSearch}
              onChange={(e) => {
                onCustomerSearchChange(e.target.value);
                onShowCustomerDropdown(true);
              }}
              onFocus={() => onShowCustomerDropdown(true)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            {showCustomerDropdown && customerSearch && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {customers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No customers found
                  </div>
                ) : (
                  customers.slice(0, 10).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onCustomerChange(c.id);
                        onCustomerSearchChange("");
                        onShowCustomerDropdown(false);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <span className="font-medium text-gray-900">{c.name}</span>
                      {c.phone && (
                        <span className="text-xs text-gray-500">{c.phone}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {cart.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <svg
                className="mx-auto mb-2 h-10 w-10 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                />
              </svg>
              <p className="text-sm text-gray-400">Cart is empty</p>
              <p className="mt-1 text-xs text-gray-300">
                Tap a menu item to add
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item) => (
              <div
                key={item.key}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                    {item.variantName && (
                      <p className="text-xs text-indigo-600">{item.variantName}</p>
                    )}
                    {item.addons.length > 0 && (
                      <p className="text-xs text-gray-500">
                        + {item.addons.map((a) => a.name).join(", ")}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {formatCurrency(item.unitPrice)} each
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.key)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Quantity controls */}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateQuantity(item.key, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.key, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {formatCurrency(item.unitPrice * item.quantity - item.discount)}
                  </span>
                </div>

                {/* Per-item discount & notes */}
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    placeholder="Disc."
                    value={item.discount || ""}
                    onChange={(e) =>
                      onUpdateItemDiscount(item.key, Number(e.target.value))
                    }
                    className="w-20 rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
                    min={0}
                  />
                  <input
                    type="text"
                    placeholder="Notes..."
                    value={item.notes ?? ""}
                    onChange={(e) => onUpdateItemNotes(item.key, e.target.value)}
                    className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-indigo-400"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order totals and controls */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        {/* Discount & Tax */}
        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-[10px] font-medium text-gray-500">
              Order Discount
            </label>
            <input
              type="number"
              value={orderDiscount || ""}
              onChange={(e) => onOrderDiscountChange(Number(e.target.value))}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
              min={0}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-[10px] font-medium text-gray-500">
              Tax Rate (%)
            </label>
            <input
              type="number"
              value={taxRate || ""}
              onChange={(e) => onTaxRateChange(Number(e.target.value))}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
              min={0}
              max={100}
            />
          </div>
        </div>

        {/* Order notes */}
        <div className="mb-3">
          <textarea
            placeholder="Order notes (optional)..."
            value={orderNotes}
            onChange={(e) => onOrderNotesChange(e.target.value)}
            rows={2}
            className="w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
        </div>

        {/* Totals */}
        <div className="mb-3 space-y-1">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(cartTotals.subtotal)}</span>
          </div>
          {cartTotals.totalItemDiscount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Item Discount</span>
              <span>-{formatCurrency(cartTotals.totalItemDiscount)}</span>
            </div>
          )}
          {orderDiscount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Order Discount</span>
              <span>-{formatCurrency(orderDiscount)}</span>
            </div>
          )}
          {taxRate > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax ({taxRate}%)</span>
              <span>{formatCurrency(cartTotals.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold text-gray-900">
            <span>Total</span>
            <span>{formatCurrency(cartTotals.grandTotal)}</span>
          </div>
        </div>

        {/* Place Order Button */}
        <button
          onClick={onPlaceOrder}
          disabled={cart.length === 0 || placingOrder}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {placingOrder ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Placing Order...
            </>
          ) : (
            <>
              Place Order - {formatCurrency(cartTotals.grandTotal)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
