"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/src/lib/auth-client";
import { useRouter } from "next/navigation";
import Sidebar from "@/src/components/Sidebar";

type InventoryItem = {
  id: string;
  name: string;
  code: string | null;
  stock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
};

export default function InventoryPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [initialStock, setInitialStock] = useState("");
  const [lowStockThreshold, setLowStockThreshold] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showAdjustment, setShowAdjustment] =
    useState(false);

  const [adjustmentProductId, setAdjustmentProductId] =
    useState("");

  const [adjustmentType, setAdjustmentType] =
    useState<"ADD" | "REMOVE">("ADD");

  const [adjustmentQuantity, setAdjustmentQuantity] =
    useState("");

  const loadInventory = async () => {
    try {
      const response = await fetch("/api/inventory");

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load inventory."
        );
      }

      setInventory(result);
    } catch (error) {
      console.error(error);
      setError("Failed to load inventory.");
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const { data } = await authClient.getSession();

      if (!data?.user) {
        router.replace("/");
        return;
      }

      setUserName(data.user.name);

      await loadInventory();

      setLoading(false);
    };

    initialize();
  }, [router]);

  const handleAdjustStock = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      console.log("ADJUSTMENT DEBUG:", {
        productId: adjustmentProductId,
        type: adjustmentType,
        quantity: adjustmentQuantity,
      });

      const response = await fetch(
        "/api/inventory/adjust",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productId: adjustmentProductId,
            type: adjustmentType,
            quantity: Number(adjustmentQuantity),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Failed to adjust stock."
        );
        return;
      }

      setSuccess(
        `Stock adjusted successfully. New stock: ${result.newStock}.`
      );

      setAdjustmentProductId("");
      setAdjustmentType("ADD");
      setAdjustmentQuantity("");
      setShowAdjustment(false);

      await loadInventory();
    } catch {
      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProduct = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          code: code || null,
          initialStock: Number(initialStock),
          lowStockThreshold: Number(lowStockThreshold),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Failed to create product."
        );
        return;
      }

      setSuccess(
        "Product created successfully."
      );

      setName("");
      setCode("");
      setInitialStock("");
      setLowStockThreshold("");
      setShowForm(false);

      await loadInventory();
    } catch {
      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8f2]">
        <p className="text-[#5b2f1f]">
          Loading...
        </p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#fff8f2]">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#a66a4a]">
                SWP Business Management System
              </p>

              <h1 className="mt-2 text-3xl font-bold text-[#3b2117]">
                Inventory
              </h1>

              <p className="mt-2 text-[#7b5a49]">
                Track products and current stock levels.
              </p>
            </div>

            <div className="rounded-xl bg-[#fff1e6] px-4 py-3">
              <p className="text-xs text-[#a66a4a]">
                Signed in as
              </p>

              <p className="font-semibold text-[#3b2117]">
                {userName}
              </p>
            </div>
          </div>

          {/* Messages */}
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

          {/* Product Management */}
          <div className="mt-8 rounded-2xl border border-[#f1dfd2] bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#3b2117]">
                  Product Management
                </h2>

                <p className="mt-1 text-sm text-[#7b5a49]">
                  Create products and monitor stock.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdjustment(true);
                    setError("");
                    setSuccess("");
                  }}
                  className="rounded-xl border border-[#d96f2b] bg-white px-5 py-3 text-sm font-semibold text-[#d96f2b] shadow-sm transition hover:bg-[#fff1e6]"
                >
                  Adjust Stock
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForm(true);
                    setError("");
                    setSuccess("");
                  }}
                  className="rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c85f22]"
                >
                  Add Product
                </button>
              </div>
            </div>

            {/* Add Product Form */}
            {showForm && (
              <div className="mt-8 rounded-2xl border border-[#f1dfd2] bg-[#fffaf6] p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-[#3b2117]">
                    Add Product
                  </h3>

                  <p className="mt-1 text-sm text-[#7b5a49]">
                    Create a new inventory product.
                  </p>
                </div>

                <form
                  onSubmit={handleCreateProduct}
                  className="space-y-5"
                >
                  {/* Name */}
                  <div>
                    <label
                      htmlFor="product-name"
                      className="mb-2 block text-sm font-semibold text-[#5b3928]"
                    >
                      Product Name
                    </label>

                    <input
                      id="product-name"
                      type="text"
                      value={name}
                      onChange={(event) =>
                        setName(event.target.value)
                      }
                      placeholder="Enter product name"
                      required
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    />
                  </div>

                  {/* Code */}
                  <div>
                    <label
                      htmlFor="product-code"
                      className="mb-2 block text-sm font-semibold text-[#5b3928]"
                    >
                      Product Code
                    </label>

                    <input
                      id="product-code"
                      type="text"
                      value={code}
                      onChange={(event) =>
                        setCode(event.target.value)
                      }
                      placeholder="Optional product code"
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    />
                  </div>

                  {/* Initial Stock */}
                  <div>
                    <label
                      htmlFor="initial-stock"
                      className="mb-2 block text-sm font-semibold text-[#5b3928]"
                    >
                      Initial Stock
                    </label>

                    <input
                      id="initial-stock"
                      type="number"
                      min="0"
                      step="1"
                      value={initialStock}
                      onChange={(event) =>
                        setInitialStock(
                          event.target.value
                        )
                      }
                      placeholder="Enter initial stock"
                      required
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    />
                  </div>

                  {/* Low Stock Threshold */}
                  <div>
                    <label
                      htmlFor="low-stock-threshold"
                      className="mb-2 block text-sm font-semibold text-[#5b3928]"
                    >
                      Low Stock Threshold
                    </label>

                    <input
                      id="low-stock-threshold"
                      type="number"
                      min="0"
                      step="1"
                      value={lowStockThreshold}
                      onChange={(event) =>
                        setLowStockThreshold(
                          event.target.value
                        )
                      }
                      placeholder="Enter low stock threshold"
                      required
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setError("");
                        setName("");
                        setCode("");
                        setInitialStock("");
                        setLowStockThreshold("");
                      }}
                      className="rounded-xl border border-[#e8d4c5] bg-white px-5 py-3 text-sm font-semibold text-[#5b3928] transition hover:bg-[#fff1e6]"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c85f22] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? "Creating..."
                        : "Create Product"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Stock Adjustment Form */}
            {showAdjustment && (
              <div className="mt-8 rounded-2xl border border-[#f1dfd2] bg-[#fffaf6] p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-[#3b2117]">
                    Adjust Stock
                  </h3>

                  <p className="mt-1 text-sm text-[#7b5a49]">
                    Add or remove stock manually. Every adjustment is recorded.
                  </p>
                </div>

                <form
                  onSubmit={handleAdjustStock}
                  className="space-y-5"
                >
                  {/* Product */}
                  <div>
                    <label
                      htmlFor="adjustment-product"
                      className="mb-2 block text-sm font-semibold text-[#5b3928]"
                    >
                      Product
                    </label>

                    <select
                      id="adjustment-product"
                      value={adjustmentProductId}
                      onChange={(event) =>
                        setAdjustmentProductId(
                          event.target.value
                        )
                      }
                      required
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    >
                      <option value="">
                        Select a product
                      </option>

                      {inventory.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.name} — Current stock:{" "}
                          {item.stock}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Adjustment Type */}
                  <div>
                    <label
                      htmlFor="adjustment-type"
                      className="mb-2 block text-sm font-semibold text-[#5b3928]"
                    >
                      Adjustment Type
                    </label>

                    <select
                      id="adjustment-type"
                      value={adjustmentType}
                      onChange={(event) =>
                        setAdjustmentType(
                          event.target.value as
                            | "ADD"
                            | "REMOVE"
                        )
                      }
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    >
                      <option value="ADD">
                        Add Stock
                      </option>

                      <option value="REMOVE">
                        Remove Stock
                      </option>
                    </select>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label
                      htmlFor="adjustment-quantity"
                      className="mb-2 block text-sm font-semibold text-[#5b3928]"
                    >
                      Quantity
                    </label>

                    <input
                      id="adjustment-quantity"
                      type="number"
                      min="1"
                      step="1"
                      value={adjustmentQuantity}
                      onChange={(event) =>
                        setAdjustmentQuantity(
                          event.target.value
                        )
                      }
                      placeholder="Enter quantity"
                      required
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdjustment(false);
                        setError("");
                        setAdjustmentProductId("");
                        setAdjustmentType("ADD");
                        setAdjustmentQuantity("");
                      }}
                      className="rounded-xl border border-[#e8d4c5] bg-white px-5 py-3 text-sm font-semibold text-[#5b3928] transition hover:bg-[#fff1e6]"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c85f22] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? "Saving..."
                        : "Adjust Stock"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Inventory Table */}
            <div className="mt-8 overflow-hidden rounded-xl border border-[#f1dfd2]">
              {inventory.length === 0 ? (
                <div className="bg-[#fffaf6] p-10 text-center">
                  <p className="font-medium text-[#5b2f1f]">
                    No products yet.
                  </p>

                  <p className="mt-2 text-sm text-[#8b6b5a]">
                    Create your first product using
                    Add Product.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#fffaf6]">
                      <tr className="border-b border-[#f1dfd2]">
                        <th className="px-5 py-4 text-sm font-semibold text-[#5b3928]">
                          Product
                        </th>

                        <th className="px-5 py-4 text-sm font-semibold text-[#5b3928]">
                          Code
                        </th>

                        <th className="px-5 py-4 text-sm font-semibold text-[#5b3928]">
                          Current Stock
                        </th>

                        <th className="px-5 py-4 text-sm font-semibold text-[#5b3928]">
                          Low Stock At
                        </th>

                        <th className="px-5 py-4 text-sm font-semibold text-[#5b3928]">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {inventory.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-[#f1dfd2] last:border-b-0"
                        >
                          <td className="px-5 py-4">
                            <p className="font-semibold text-[#3b2117]">
                              {item.name}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-sm text-[#7b5a49]">
                            {item.code || "—"}
                          </td>

                          <td className="px-5 py-4">
                            <span className="text-lg font-bold text-[#3b2117]">
                              {item.stock}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm text-[#7b5a49]">
                            {item.lowStockThreshold}
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
          </div>
        </div>
      </main>
    </div>
  );
}