
"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/src/lib/auth-client";
import { useRouter } from "next/navigation";
import Sidebar from "@/src/components/Sidebar";

type InventoryItem = {
  id: string;
  name: string;
  code: string | null;
  stockKg: number;
  lowStockThresholdKg: number;
  isLowStock: boolean;
};

function formatKg(value: number) {
  return `${Number(value).toFixed(3)} kg`;
}

export default function InventoryPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [initialStock, setInitialStock] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("0");

  const [adjustmentProductId, setAdjustmentProductId] = useState("");
  const [adjustmentType, setAdjustmentType] =
    useState<"ADD" | "REMOVE">("ADD");
  const [adjustmentWeight, setAdjustmentWeight] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadInventory = useCallback(async () => {
    const response = await fetch("/api/inventory", {
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to load inventory.");
    }

    if (!Array.isArray(result)) {
      throw new Error("The inventory API returned an unexpected response.");
    }

    setInventory(
      result.map((item: InventoryItem) => ({
        ...item,
        stockKg: Number(item.stockKg),
        lowStockThresholdKg: Number(item.lowStockThresholdKg),
        isLowStock: Boolean(item.isLowStock),
      }))
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        const { data } = await authClient.getSession();

        if (!data?.user) {
          router.replace("/");
          return;
        }

        if (!cancelled) {
          setUserName(data.user.name);
        }

        await loadInventory();
      } catch (err) {
        console.error("Inventory initialization failed:", err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load inventory."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [router, loadInventory]);

  const handleCreateProduct = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const initialStockKg = Number(initialStock);
    const lowStockThresholdKg = Number(lowStockThreshold);

    const validKg = (value: number) =>
      Number.isFinite(value) &&
      value >= 0 &&
      Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-8;

    if (name.trim().length < 2) {
      setError("Product name must be at least 2 characters.");
      return;
    }

    if (!validKg(initialStockKg)) {
      setError("Initial stock must be non-negative with up to 3 decimal places.");
      return;
    }

    if (!validKg(lowStockThresholdKg)) {
      setError("Low stock threshold must be non-negative with up to 3 decimal places.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || null,
          initialStockKg,
          lowStockThresholdKg,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to create product.");
        return;
      }

      await loadInventory();

      setSuccess("Product created successfully.");
      setName("");
      setCode("");
      setInitialStock("0");
      setLowStockThreshold("0");
      setShowForm(false);
    } catch (err) {
      console.error("Product creation failed:", err);
      setError("Failed to create product. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustStock = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const weightKg = Number(adjustmentWeight);

    if (!adjustmentProductId) {
      setError("Please select a product.");
      return;
    }

    if (
      !Number.isFinite(weightKg) ||
      weightKg <= 0 ||
      Math.abs(weightKg * 1000 - Math.round(weightKg * 1000)) >= 1e-8
    ) {
      setError("Weight must be greater than 0 kg with up to 3 decimal places.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: adjustmentProductId,
          type: adjustmentType,
          weightKg,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to adjust stock.");
        return;
      }

      await loadInventory();

      const newStock = result.newStockKg ?? result.newStock;

      setSuccess(
        typeof newStock === "number"
          ? `Stock adjusted successfully. New stock: ${formatKg(newStock)}.`
          : "Stock adjusted successfully."
      );

      setAdjustmentProductId("");
      setAdjustmentType("ADD");
      setAdjustmentWeight("");
      setShowAdjustment(false);
    } catch (err) {
      console.error("Stock adjustment failed:", err);
      setError("Failed to adjust stock. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8f2]">
        <p className="text-[#5b2f1f]">Loading inventory...</p>
      </main>
    );
  }

  return (
    <div className="swp-inventory flex min-h-screen min-w-0 bg-[#fff8f2]">
      <Sidebar />

      <main className="swp-page-main min-w-0 flex-1 p-4 sm:p-8">
        <div className="swp-page-content mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-[#a66a4a]">
                SWP Business Management System
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#3b2117]">
                Inventory
              </h1>
              <p className="mt-2 text-[#7b5a49]">
                Track product stock in kilograms.
              </p>
            </div>

            <div className="swp-user-chip rounded-xl bg-[#fff1e6] px-4 py-3">
              <p className="text-xs text-[#a66a4a]">Signed in as</p>
              <p className="font-semibold text-[#3b2117]">{userName}</p>
            </div>
          </div>

          {success && (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="mt-5 min-w-0 rounded-2xl border border-[#f1dfd2] bg-white p-4 shadow-sm sm:mt-8 sm:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold text-[#3b2117]">
                  Product Management
                </h2>
                <p className="mt-1 text-sm text-[#7b5a49]">
                  Create products and manage stock in kg.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdjustment((value) => !value);
                    setShowForm(false);
                    setError("");
                    setSuccess("");
                  }}
                  className="rounded-xl border border-[#d96f2b] bg-white px-5 py-3 text-sm font-semibold text-[#d96f2b] hover:bg-[#fff1e6]"
                >
                  Adjust Stock
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForm((value) => !value);
                    setShowAdjustment(false);
                    setError("");
                    setSuccess("");
                  }}
                  className="rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#c85f22]"
                >
                  Add Product
                </button>
              </div>
            </div>

            {showForm && (
              <form
                onSubmit={handleCreateProduct}
                className="mt-8 space-y-5 rounded-2xl border border-[#f1dfd2] bg-[#fffaf6] p-5 sm:p-6"
              >
                <h3 className="text-lg font-semibold text-[#3b2117]">
                  Add Product
                </h3>

                <div>
                  <label htmlFor="product-name" className="mb-2 block text-sm font-semibold text-[#5b3928]">
                    Product Name
                  </label>
                  <input
                    id="product-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Enter product name"
                    required
                    minLength={2}
                    className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm outline-none focus:border-[#d9793a]"
                  />
                </div>

                <div>
                  <label htmlFor="product-code" className="mb-2 block text-sm font-semibold text-[#5b3928]">
                    Product Code
                  </label>
                  <input
                    id="product-code"
                    type="text"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="Optional product code"
                    className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm outline-none focus:border-[#d9793a]"
                  />
                </div>

                <div>
                  <label htmlFor="initial-stock" className="mb-2 block text-sm font-semibold text-[#5b3928]">
                    Initial Stock (kg)
                  </label>
                  <input
                    id="initial-stock"
                    type="number"
                    min="0"
                    step="0.001"
                    value={initialStock}
                    onChange={(event) => setInitialStock(event.target.value)}
                    required
                    className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm outline-none focus:border-[#d9793a]"
                  />
                </div>

                <div>
                  <label htmlFor="low-stock-threshold" className="mb-2 block text-sm font-semibold text-[#5b3928]">
                    Low Stock Threshold (kg)
                  </label>
                  <input
                    id="low-stock-threshold"
                    type="number"
                    min="0"
                    step="0.001"
                    value={lowStockThreshold}
                    onChange={(event) => setLowStockThreshold(event.target.value)}
                    required
                    className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm outline-none focus:border-[#d9793a]"
                  />
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setName("");
                      setCode("");
                      setInitialStock("0");
                      setLowStockThreshold("0");
                    }}
                    className="rounded-xl border border-[#e8d4c5] bg-white px-5 py-3 text-sm font-semibold text-[#5b3928]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? "Creating..." : "Create Product"}
                  </button>
                </div>
              </form>
            )}

            {showAdjustment && (
              <form
                onSubmit={handleAdjustStock}
                className="mt-8 space-y-5 rounded-2xl border border-[#f1dfd2] bg-[#fffaf6] p-5 sm:p-6"
              >
                <h3 className="text-lg font-semibold text-[#3b2117]">
                  Adjust Stock
                </h3>
                <p className="text-sm text-[#7b5a49]">
                  Add or remove stock manually. Adjustments are recorded in the inventory ledger.
                </p>

                <div>
                  <label htmlFor="adjustment-product" className="mb-2 block text-sm font-semibold text-[#5b3928]">
                    Product
                  </label>
                  <select
                    id="adjustment-product"
                    value={adjustmentProductId}
                    onChange={(event) => setAdjustmentProductId(event.target.value)}
                    required
                    className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm outline-none focus:border-[#d9793a]"
                  >
                    <option value="">Select a product</option>
                    {inventory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — Current stock: {formatKg(item.stockKg)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="adjustment-type" className="mb-2 block text-sm font-semibold text-[#5b3928]">
                    Adjustment Type
                  </label>
                  <select
                    id="adjustment-type"
                    value={adjustmentType}
                    onChange={(event) =>
                      setAdjustmentType(event.target.value as "ADD" | "REMOVE")
                    }
                    className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm outline-none focus:border-[#d9793a]"
                  >
                    <option value="ADD">Add Stock</option>
                    <option value="REMOVE">Remove Stock</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="adjustment-weight" className="mb-2 block text-sm font-semibold text-[#5b3928]">
                    Weight (kg)
                  </label>
                  <input
                    id="adjustment-weight"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={adjustmentWeight}
                    onChange={(event) => setAdjustmentWeight(event.target.value)}
                    placeholder="Enter weight in kg"
                    required
                    className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm outline-none focus:border-[#d9793a]"
                  />
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdjustment(false);
                      setAdjustmentProductId("");
                      setAdjustmentType("ADD");
                      setAdjustmentWeight("");
                    }}
                    className="rounded-xl border border-[#e8d4c5] bg-white px-5 py-3 text-sm font-semibold text-[#5b3928]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Adjust Stock"}
                  </button>
                </div>
              </form>
            )}

            <div className="swp-inventory-table-wrap mt-6 overflow-hidden rounded-xl border border-[#f1dfd2] sm:mt-8">
              {inventory.length === 0 ? (
                <div className="bg-[#fffaf6] p-10 text-center">
                  <p className="font-medium text-[#5b2f1f]">No products yet.</p>
                  <p className="mt-2 text-sm text-[#8b6b5a]">
                    Create your first product using Add Product.
                  </p>
                </div>
              ) : (
                <div className="swp-inventory-table-scroll overflow-x-auto">
                  <table className="swp-inventory-table w-full text-left">
                    <thead className="bg-[#fffaf6]">
                      <tr className="border-b border-[#f1dfd2]">
                        <th className="px-5 py-4 text-sm font-semibold text-[#5b3928]">Product</th>
                        <th className="px-5 py-4 text-sm font-semibold text-[#5b3928]">Code</th>
                        <th className="px-5 py-4 text-sm font-semibold text-[#5b3928]">Current Stock (kg)</th>
                        <th className="px-5 py-4 text-sm font-semibold text-[#5b3928]">Low Stock At (kg)</th>
                        <th className="px-5 py-4 text-sm font-semibold text-[#5b3928]">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((item) => (
                        <tr key={item.id} className="border-b border-[#f1dfd2] last:border-b-0">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-[#3b2117]">{item.name}</p>
                          </td>
                          <td className="px-5 py-4 text-sm text-[#7b5a49]">
                            {item.code || "—"}
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-lg font-bold text-[#3b2117]">
                              {formatKg(item.stockKg)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-[#7b5a49]">
                            {formatKg(item.lowStockThresholdKg)}
                          </td>
                          <td className="px-5 py-4">
                            {item.isLowStock ? (
                              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                                Low Stock
                              </span>
                            ) : (
                              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                                In Stock
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
