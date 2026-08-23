"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/src/lib/auth-client";
import { useRouter } from "next/navigation";
import Sidebar from "@/src/components/Sidebar";

type Product = {
  id: string;
  name: string;
  code: string | null;
};

type InventoryItem = Product & {
  stock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
};

type Sale = {
  id: string;
  customerName: string;
  quantity: number;
  saleDate: string;
  status: "ACTIVE" | "VOIDED";
  product: Product;
  createdBy: {
    name: string;
    username: string;
  };
};

export default function SalesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "WORKER" | null>(null);

  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saleDate, setSaleDate] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = async () => {
    try {
      const [inventoryResponse, salesResponse] =
        await Promise.all([
          fetch("/api/inventory"),
          fetch("/api/sales"),
        ]);

      const inventoryResult =
        await inventoryResponse.json();

      const salesResult =
        await salesResponse.json();

      if (!inventoryResponse.ok) {
        throw new Error(
          inventoryResult.error ||
            "Failed to load inventory."
        );
      }

      if (!salesResponse.ok) {
        throw new Error(
          salesResult.error ||
            "Failed to load sales."
        );
      }

      setProducts(inventoryResult);
      setSales(salesResult);
    } catch (error) {
      console.error(error);
      setError("Failed to load sales data.");
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data } =
          await authClient.getSession();

        if (!data?.user) {
          router.replace("/");
          return;
        }

        setUserName(data.user.name);

        const employeeResponse = await fetch(
          "/api/me/employee"
        );

        if (!employeeResponse.ok) {
          router.replace("/dashboard");
          return;
        }

        const employee =
          await employeeResponse.json();

        /*
         * Sales are Admin-only.
         * Redirect Workers before loading
         * any sales data.
         */
        if (employee.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }

        setRole(employee.role);

        await loadData();

        const today =
          new Date().toISOString().split("T")[0];

        setSaleDate(today);

        setLoading(false);
      } catch (error) {
        console.error(
          "Sales page initialization failed:",
          error
        );

        router.replace("/dashboard");
      }
    };

    initialize();
  }, [router]);

  const selectedProduct = products.find(
    (product) => product.id === productId
  );

  const handleVoidSale = async (saleId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to void this sale?"
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await fetch(
        `/api/sales/${saleId}/void`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Failed to void sale."
        );
        return;
      }

      setSuccess(
        "Sale voided successfully."
      );

      await loadData();
    } catch {
      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSale = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await fetch(
        "/api/sales",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerName,
            productId,
            quantity: Number(quantity),
            saleDate,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Failed to create sale."
        );
        return;
      }

      setSuccess(
        "Sale created successfully."
      );

      setCustomerName("");
      setProductId("");
      setQuantity("");

      await loadData();
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
                Sales
              </h1>

              <p className="mt-2 text-[#7b5a49]">
                Record customer sales and track stock movement.
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

          <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* Create Sale */}
            <div className="rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#3b2117]">
                Create Sale
              </h2>

              <p className="mt-1 text-sm text-[#7b5a49]">
                Record a product sale.
              </p>

              <form
                onSubmit={handleCreateSale}
                className="mt-6 space-y-5"
              >
                {/* Customer */}
                <div>
                  <label
                    htmlFor="customer-name"
                    className="mb-2 block text-sm font-semibold text-[#5b3928]"
                  >
                    Customer Name
                  </label>

                  <input
                    id="customer-name"
                    type="text"
                    value={customerName}
                    onChange={(event) =>
                      setCustomerName(
                        event.target.value
                      )
                    }
                    placeholder="Enter customer name"
                    required
                    className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                  />
                </div>

                {/* Product */}
                <div>
                  <label
                    htmlFor="sale-product"
                    className="mb-2 block text-sm font-semibold text-[#5b3928]"
                  >
                    Product
                  </label>

                  <select
                    id="sale-product"
                    value={productId}
                    onChange={(event) =>
                      setProductId(
                        event.target.value
                      )
                    }
                    required
                    className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                  >
                    <option value="">
                      Select a product
                    </option>

                    {products.map((product) => (
                      <option
                        key={product.id}
                        value={product.id}
                        disabled={
                          product.stock <= 0
                        }
                      >
                        {product.name}
                        {product.code
                          ? ` (${product.code})`
                          : ""}{" "}
                        — Stock: {product.stock}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected stock */}
                {selectedProduct && (
                  <div
                    className={`rounded-xl px-4 py-3 text-sm ${
                      selectedProduct.isLowStock
                        ? "bg-red-50 text-red-700"
                        : "bg-green-50 text-green-700"
                    }`}
                  >
                    Available stock:{" "}
                    <span className="font-bold">
                      {selectedProduct.stock}
                    </span>
                  </div>
                )}

                {/* Quantity */}
                <div>
                  <label
                    htmlFor="sale-quantity"
                    className="mb-2 block text-sm font-semibold text-[#5b3928]"
                  >
                    Quantity
                  </label>

                  <input
                    id="sale-quantity"
                    type="number"
                    min="1"
                    step="1"
                    max={
                      selectedProduct
                        ? selectedProduct.stock
                        : undefined
                    }
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(
                        event.target.value
                      )
                    }
                    placeholder="Enter quantity"
                    required
                    className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                  />
                </div>

                {/* Sale Date */}
                <div>
                  <label
                    htmlFor="sale-date"
                    className="mb-2 block text-sm font-semibold text-[#5b3928]"
                  >
                    Sale Date
                  </label>

                  <input
                    id="sale-date"
                    type="date"
                    value={saleDate}
                    onChange={(event) =>
                      setSaleDate(
                        event.target.value
                      )
                    }
                    required
                    className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c85f22] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Creating..."
                    : "Create Sale"}
                </button>
              </form>
            </div>

            {/* Sales History */}
            <div className="rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#3b2117]">
                    Sales History
                  </h2>

                  <p className="mt-1 text-sm text-[#7b5a49]">
                    Recent sales recorded in the system.
                  </p>
                </div>

                <span className="rounded-full bg-[#fff1e6] px-3 py-1 text-xs font-semibold text-[#a64b2b]">
                  {sales.length} sales
                </span>
              </div>

              {sales.length === 0 ? (
                <div className="mt-8 rounded-xl border border-dashed border-[#e5cdbd] bg-[#fffaf6] p-10 text-center">
                  <p className="font-medium text-[#5b2f1f]">
                    No sales yet.
                  </p>

                  <p className="mt-2 text-sm text-[#8b6b5a]">
                    Create your first sale using the form.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {sales.map((sale) => (
                    <div
                      key={sale.id}
                      className="rounded-xl border border-[#f1dfd2] bg-[#fffaf6] p-4"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-[#3b2117]">
                            {sale.product.name}
                          </p>

                          <p className="mt-1 text-sm text-[#5b3928]">
                            Customer:{" "}
                            {sale.customerName}
                          </p>

                          <p className="mt-1 text-sm text-[#7b5a49]">
                            Quantity:{" "}
                            {sale.quantity}
                          </p>

                          <p className="mt-1 text-xs text-[#9a7865]">
                            Sale date:{" "}
                            {new Date(
                              sale.saleDate
                            ).toLocaleDateString()}
                          </p>

                          <p className="mt-1 text-xs text-[#9a7865]">
                            Created by:{" "}
                            {sale.createdBy.name}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              sale.status === "ACTIVE"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {sale.status}
                          </span>

                          {role === "ADMIN" &&
                            sale.status === "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleVoidSale(
                                    sale.id
                                  )
                                }
                                disabled={saving}
                                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Void
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}