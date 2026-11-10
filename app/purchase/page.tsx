"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";
import Sidebar from "@/src/components/Sidebar";

type Supplier = {
  id: string;
  name: string;
  phone?: string | null;
};

type Product = {
  id: string;
  name: string;
  code?: string | null;
};

type PurchaseItem = {
  productId: string;
  quantity: string;
  weight: string;
  rate: string;
};

type Purchase = {
  id: string;
  invoiceNumber?: string | null;
  purchaseDate: string;
  totalAmount: number;
  status: "ACTIVE" | "VOIDED";
  supplier: { id: string; name: string };
  items: {
    id: string;
    quantity?: number | null;
    weight: number;
    rate: number;
    amount: number;
    product: { name: string };
  }[];
  createdBy?: { name: string };
};

const inputClass =
  "mt-1 h-11 w-full rounded-xl border border-[#e8d4c5] bg-[#F2EAD2] px-3 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-2 focus:ring-[#fce3d0]";

const money = (value: number) => Number(value || 0).toFixed(2);

export default function PurchasePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([
    { productId: "", quantity: "", weight: "", rate: "" },
  ]);

  const [supplierSearch, setSupplierSearch] = useState("");
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = async () => {
    const [supplierRes, inventoryRes, purchaseRes] = await Promise.all([
      fetch("/api/suppliers"),
      fetch("/api/inventory"),
      fetch("/api/purchases"),
    ]);

    const [supplierData, inventoryData, purchaseData] = await Promise.all([
      supplierRes.json(),
      inventoryRes.json(),
      purchaseRes.json(),
    ]);

    if (!supplierRes.ok)
      throw new Error(supplierData.error || "Failed to load suppliers.");

    if (!inventoryRes.ok)
      throw new Error(inventoryData.error || "Failed to load inventory.");

    if (!purchaseRes.ok)
      throw new Error(purchaseData.error || "Failed to load purchases.");

    setSuppliers(Array.isArray(supplierData) ? supplierData : []);
    setProducts(Array.isArray(inventoryData) ? inventoryData : []);
    setPurchases(Array.isArray(purchaseData) ? purchaseData : []);
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data } = await authClient.getSession();

        if (!data?.user) {
          router.replace("/");
          return;
        }

        const employeeRes = await fetch("/api/me/employee");

        if (!employeeRes.ok) {
          router.replace("/dashboard");
          return;
        }

        const employee = await employeeRes.json();

        if (employee.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }

        await loadData();

        const today = new Date();

        setPurchaseDate(
          [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, "0"),
            String(today.getDate()).padStart(2, "0"),
          ].join("-")
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load purchase data."
        );
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [router]);

  const filteredSuppliers = useMemo(() => {
    const query = supplierSearch.trim().toLowerCase();

    return suppliers.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(query) ||
        (supplier.phone ?? "").includes(query)
    );
  }, [suppliers, supplierSearch]);

  const filteredPurchases = useMemo(() => {
    const query = purchaseSearch.trim().toLowerCase();

    return purchases.filter((purchase) => {
      const matchesSupplier = purchase.supplier.name
        .toLowerCase()
        .includes(query);

      const matchesInvoice = (purchase.invoiceNumber ?? "")
        .toLowerCase()
        .includes(query);

      const matchesDate =
        !dateFilter || purchase.purchaseDate.slice(0, 10) === dateFilter;

      return (matchesSupplier || matchesInvoice) && matchesDate;
    });
  }, [purchases, purchaseSearch, dateFilter]);

  const lineAmounts = items.map((item) => {
    const weight = Number(item.weight);
    const rate = Number(item.rate);

    if (!item.weight || !item.rate || !Number.isFinite(weight * rate))
      return 0;

    return Math.round(weight * rate * 100) / 100;
  });

  const totalAmount = lineAmounts.reduce(
    (sum, amount) => sum + amount,
    0
  );

  const updateItem = (
    index: number,
    field: keyof PurchaseItem,
    value: string
  ) => {
    setItems((previous) =>
      previous.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const addItem = () => {
    setItems((previous) => [
      ...previous,
      { productId: "", quantity: "", weight: "", rate: "" },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((previous) => previous.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setSupplierId("");
    setInvoiceNumber("");
    setItems([{ productId: "", quantity: "", weight: "", rate: "" }]);
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!supplierId) {
      setError("Please select a supplier.");
      return;
    }

    if (
      items.some(
        (item) =>
          !item.productId ||
          Number(item.weight) <= 0 ||
          Number(item.rate) <= 0
      )
    ) {
      setError("Please select products and enter valid weight and rate.");
      return;
    }

    const selectedIds = items.map((item) => item.productId);

    if (new Set(selectedIds).size !== selectedIds.length) {
      setError("A product can only be added once per purchase invoice.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          invoiceNumber,
          purchaseDate,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity.trim()
              ? Number(item.quantity)
              : null,
            weight: Number(item.weight),
            rate: Number(item.rate),
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok)
        throw new Error(result.error || "Failed to save purchase.");

      await loadData();
      resetForm();
      setSuccess("Purchase saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save purchase."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fffaf6] text-[#5b3928]">
        Loading purchases...
      </div>
    );
  }

  return (
   <div className="flex min-h-screen bg-[#fffaf6]">
      <Sidebar />

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* PAGE HEADER */}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold text-[#0B3829]">
                Purchase Management
              </h1>

              <p className="mt-1 text-sm text-[#7b5a49]">
                Record purchases, manage suppliers and track incoming stock.
              </p>
            </div>

            {/* MANAGE SUPPLIERS BUTTON */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/suppliers")}
                className="rounded-xl bg-[#0B3829] px-4 py-2.5 text-sm font-semibold text-[#F2EAD2] transition hover:bg-[#365B49]"
              >
                Manage Suppliers →
              </button>

              <span className="w-fit rounded-full bg-[#E5E9DA] px-4 py-2 text-sm font-semibold text-[#a64b2b]">
                {purchases.length} purchase records
              </span>
            </div>
          </div>

          {/* ERROR MESSAGE */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* SUCCESS MESSAGE */}
          {success && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {success}
            </div>
          )}

          {/* NEW PURCHASE FORM */}
          <section className="rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-[#0B3829]">
                New Purchase
              </h2>

              <p className="mt-1 text-sm text-[#7b5a49]">
                Enter supplier and invoice details, then add purchased products.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm font-medium text-[#5b3928]">
                  Search Supplier

                  <input
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    placeholder="Search supplier name or phone"
                    className={inputClass}
                  />
                </label>

                <label className="text-sm font-medium text-[#5b3928]">
                  Select Supplier

                  <select
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Choose supplier</option>

                    {filteredSuppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-[#5b3928]">
                  Invoice Number

                  <input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Enter invoice number"
                    className={inputClass}
                  />
                </label>

                <label className="text-sm font-medium text-[#5b3928]">
                  Purchase Date

                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              {/* PURCHASED PRODUCTS */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-[#0B3829]">
                    Purchased Products
                  </h3>

                  <p className="mt-1 text-xs text-[#8b6b5a]">
                    Amount is calculated as weight × rate per kg.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  className="rounded-xl border border-[#e8d4c5] bg-[#fff7ed] px-4 py-2.5 text-sm font-semibold text-[#a64b2b] transition hover:bg-[#ffeddd]"
                >
                  + Add Product
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-[#D5CBB3] bg-[#fffaf6] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-[#5b3928]">
                        Product {index + 1}
                      </span>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-sm font-semibold text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <label className="text-sm text-[#5b3928] lg:col-span-1">
                        Product

                        <select
                          required
                          value={item.productId}
                          onChange={(e) =>
                            updateItem(index, "productId", e.target.value)
                          }
                          className={inputClass}
                        >
                          <option value="">Select product</option>

                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                              {product.code ? ` (${product.code})` : ""}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm text-[#5b3928]">
                        Quantity (Nos)

                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, "quantity", e.target.value)
                          }
                          placeholder="Optional"
                          className={inputClass}
                        />
                      </label>

                      <label className="text-sm text-[#5b3928]">
                        Weight (Kg)

                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          required
                          value={item.weight}
                          onChange={(e) =>
                            updateItem(index, "weight", e.target.value)
                          }
                          placeholder="0.000"
                          className={inputClass}
                        />
                      </label>

                      <label className="text-sm text-[#5b3928]">
                        Rate / Kg

                        <input
                          type="number"
                          min="0.000001"
                          step="0.000001"
                          required
                          value={item.rate}
                          onChange={(e) =>
                            updateItem(index, "rate", e.target.value)
                          }
                          placeholder="0.00"
                          className={inputClass}
                        />
                      </label>

                      <div>
                        <span className="text-sm text-[#5b3928]">
                          Amount
                        </span>

                        <div className="mt-1 flex h-11 items-center rounded-xl border border-[#ead8c9] bg-[#f8f2ec] px-3 font-semibold text-[#0B3829]">
                          ₹ {money(lineAmounts[index])}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* TOTAL */}
              <div className="rounded-xl bg-[#fff7ed] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#5b3928]">
                    Total Purchase Amount
                  </span>

                  <span className="text-xl font-bold text-[#0B3829]">
                    ₹ {money(totalAmount)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || items.length === 0}
                className="w-full rounded-xl bg-[#0B3829] px-5 py-3 text-sm font-semibold text-[#F2EAD2] shadow-sm transition hover:bg-[#365B49] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Purchase"}
              </button>
            </form>
          </section>

          {/* PURCHASE HISTORY */}
          <section className="rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-5 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold text-[#0B3829]">
                  Purchase History
                </h2>

                <p className="mt-1 text-sm text-[#7b5a49]">
                  View saved invoices and purchased products.
                </p>
              </div>

              <span className="w-fit rounded-full bg-[#E5E9DA] px-3 py-1 text-xs font-semibold text-[#a64b2b]">
                {filteredPurchases.length} records
              </span>
            </div>

            {/* SEARCH AND FILTERS */}
            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
              <input
                value={purchaseSearch}
                onChange={(e) => setPurchaseSearch(e.target.value)}
                placeholder="Search supplier or invoice..."
                className={inputClass}
              />

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className={inputClass}
              />

              <button
                type="button"
                onClick={() => {
                  setPurchaseSearch("");
                  setDateFilter("");
                }}
                className="h-11 rounded-xl border border-[#e8d4c5] px-4 text-sm font-semibold text-[#365B49] hover:bg-[#fff7ed]"
              >
                Clear Filters
              </button>
            </div>

            {/* EMPTY STATE */}
            {filteredPurchases.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-[#e5cdbd] bg-[#fffaf6] p-10 text-center">
                <p className="font-medium text-[#0B3829]">
                  No purchases found.
                </p>

                <p className="mt-2 text-sm text-[#8b6b5a]">
                  Saved purchase invoices will appear here.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {filteredPurchases.map((purchase) => (
                  <article
                    key={purchase.id}
                    className="rounded-xl border border-[#D5CBB3] bg-[#fffaf6] p-4"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <p className="font-semibold text-[#0B3829]">
                          {purchase.supplier.name}
                        </p>

                        <p className="mt-1 text-xs text-[#7b5a49]">
                          Invoice: {purchase.invoiceNumber || "—"} ·{" "}
                          {new Date(
                            purchase.purchaseDate
                          ).toLocaleDateString()}
                        </p>

                        <p className="mt-1 text-xs text-[#7b5a49]">
                          {purchase.items.length} product(s)
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            purchase.status === "ACTIVE"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {purchase.status}
                        </span>

                        <span className="text-lg font-bold text-[#0B3829]">
                          ₹ {money(Number(purchase.totalAmount))}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-[#D5CBB3] pt-3">
                      {purchase.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-wrap justify-between gap-2 py-1 text-sm text-[#5b3928]"
                        >
                          <span>{item.product.name}</span>

                          <span>
                            {item.quantity ?? "—"} pcs ·{" "}
                            {Number(item.weight).toFixed(3)} kg
                          </span>

                          <span className="font-medium">
                            ₹ {money(Number(item.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}