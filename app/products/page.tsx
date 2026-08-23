"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/src/lib/auth-client";
import { useRouter } from "next/navigation";
import Sidebar from "@/src/components/Sidebar";

type Product = {
  id: string;
  name: string;
  code: string | null;
  initialStock: number;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function ProductsPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [userName, setUserName] =
    useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [name, setName] =
    useState("");

  const [code, setCode] =
    useState("");

  const [initialStock, setInitialStock] =
    useState("");

  const [lowStockThreshold, setLowStockThreshold] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [updatingId, setUpdatingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const loadProducts = async () => {
    const response = await fetch(
      "/api/products",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const text =
      await response.text();

    if (!text.trim()) {
      throw new Error(
        `Products API returned an empty response (HTTP ${response.status}).`
      );
    }

    let result:
      | Product[]
      | { error?: string };

    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(
        `Products API returned invalid JSON (HTTP ${response.status}).`
      );
    }

    if (!response.ok) {
      throw new Error(
        "error" in result
          ? result.error ||
              "Failed to load products."
          : "Failed to load products."
      );
    }

    if (!Array.isArray(result)) {
      throw new Error(
        "Products API returned an unexpected response."
      );
    }

    setProducts(result);
  };

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        const { data } =
          await authClient.getSession();

        if (!data?.user) {
          router.replace("/");
          return;
        }

        const employeeResponse =
          await fetch(
            "/api/me/employee",
            {
              cache: "no-store",
            }
          );

        if (!employeeResponse.ok) {
          router.replace(
            "/dashboard"
          );
          return;
        }

        const employee =
          await employeeResponse.json();

        if (
          employee.role !== "ADMIN"
        ) {
          router.replace(
            "/dashboard"
          );
          return;
        }

        if (cancelled) {
          return;
        }

        setUserName(
          data.user.name
        );

        await loadProducts();
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Products page loading failed:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load products."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setCode("");
    setInitialStock("");
    setLowStockThreshold("");
  };

  const startCreate = () => {
    setError("");
    setSuccess("");
    resetForm();
    setShowForm(true);
  };

  const startEdit = (
    product: Product
  ) => {
    setError("");
    setSuccess("");

    setEditingId(product.id);
    setName(product.name);
    setCode(product.code ?? "");
    setInitialStock(
      String(product.initialStock)
    );
    setLowStockThreshold(
      String(
        product.lowStockThreshold
      )
    );

    setShowForm(true);
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const isEditing =
        editingId !== null;

      const response = await fetch(
        isEditing
          ? `/api/products/${editingId}`
          : "/api/products",
        {
          method: isEditing
            ? "PATCH"
            : "POST",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify({
            ...(isEditing
              ? {
                  action: "UPDATE",
                }
              : {}),
            name: name.trim(),
            code: code.trim(),
            initialStock:
              Number(initialStock),
            lowStockThreshold:
              Number(
                lowStockThreshold
              ),
          }),
        }
      );

      const text =
        await response.text();

      if (!text.trim()) {
        throw new Error(
          `Products API returned an empty response (HTTP ${response.status}).`
        );
      }

      let result: {
        error?: string;
        message?: string;
      };

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(
          `Products API returned invalid JSON (HTTP ${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to save product."
        );
      }

      setSuccess(
        result.message ||
          (isEditing
            ? "Product updated successfully."
            : "Product created successfully.")
      );

      resetForm();

      await loadProducts();
    } catch (error) {
      console.error(
        "Product save failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to save product."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (
    product: Product
  ) => {
    const isActive =
      product.isActive;

    const action = isActive
      ? "DEACTIVATE"
      : "REACTIVATE";

    const confirmed =
      window.confirm(
        isActive
          ? `Deactivate ${product.name}? It will no longer appear in normal product selections.`
          : `Reactivate ${product.name}?`
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    setUpdatingId(product.id);

    try {
      const response = await fetch(
        `/api/products/${product.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify({
            action,
          }),
        }
      );

      const text =
        await response.text();

      if (!text.trim()) {
        throw new Error(
          `Products API returned an empty response (HTTP ${response.status}).`
        );
      }

      let result: {
        error?: string;
        message?: string;
      };

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(
          `Products API returned invalid JSON (HTTP ${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to update product."
        );
      }

      setSuccess(
        result.message ||
          "Product status updated successfully."
      );

      await loadProducts();
    } catch (error) {
      console.error(
        "Product status update failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to update product."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8f2]">
        <p className="text-[#5b2f1f]">
          Loading products...
        </p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#fff8f2]">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-[#a66a4a]">
                SWP Business Management System
              </p>

              <h1 className="mt-2 text-3xl font-bold text-[#3b2117]">
                Products
              </h1>

              <p className="mt-2 text-[#7b5a49]">
                Manage products and inventory settings.
              </p>
            </div>

            <div className="rounded-2xl border border-[#f1dfd2] bg-white px-6 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#a66a4a]">
                Signed in as
              </p>

              <p className="mt-1 font-semibold text-[#3b2117]">
                {userName}
              </p>

              <p className="mt-1 text-xs text-[#8b6b5a]">
                Administrator
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-medium text-green-700">
              {success}
            </div>
          )}

          <section className="mt-8 rounded-2xl border border-[#f1dfd2] bg-white shadow-sm">

            <div className="flex flex-col gap-4 border-b border-[#f1dfd2] px-6 py-6 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <h2 className="text-lg font-bold text-[#3b2117]">
                  Product Management
                </h2>

                <p className="mt-1 text-sm text-[#7b5a49]">
                  Create, edit and manage products.
                </p>
              </div>

              <button
                type="button"
                onClick={startCreate}
                className="rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c85f22]"
              >
                Add Product
              </button>

            </div>

            {showForm && (
              <div className="border-b border-[#f1dfd2] bg-[#fffaf6] p-6">

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-[#3b2117]">
                    {editingId
                      ? "Edit Product"
                      : "Add Product"}
                  </h3>

                  <p className="mt-1 text-sm text-[#7b5a49]">
                    {editingId
                      ? "Update product information and stock threshold."
                      : "Create a new product."}
                  </p>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="grid gap-5 md:grid-cols-2"
                >

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
                        setName(
                          event.target.value
                        )
                      }
                      required
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    />
                  </div>

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
                        setCode(
                          event.target.value
                        )
                      }
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    />
                  </div>

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
                      disabled={
                        editingId !== null
                      }
                      required
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm outline-none disabled:bg-gray-100 disabled:text-gray-500 focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    />

                    {editingId && (
                      <p className="mt-2 text-xs text-[#9a7865]">
                        Initial stock cannot be changed here. Use inventory adjustments for stock changes.
                      </p>
                    )}
                  </div>

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
                      value={
                        lowStockThreshold
                      }
                      onChange={(event) =>
                        setLowStockThreshold(
                          event.target.value
                        )
                      }
                      required
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    />
                  </div>

                  <div className="flex justify-end gap-3 md:col-span-2">

                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={saving}
                      className="rounded-xl border border-[#e8d4c5] bg-white px-5 py-3 text-sm font-semibold text-[#5b3928] hover:bg-[#fff1e6]"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#c85f22] disabled:opacity-60"
                    >
                      {saving
                        ? "Saving..."
                        : editingId
                          ? "Save Changes"
                          : "Create Product"}
                    </button>

                  </div>

                </form>
              </div>
            )}

            <div className="overflow-x-auto">

              {products.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="font-semibold text-[#5b2f1f]">
                    No active products found.
                  </p>
                </div>
              ) : (
                <table className="w-full min-w-[1050px]">

                  <thead>
                    <tr className="border-b border-[#f1dfd2] bg-[#fffaf6] text-left">

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                        Product
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                        Code
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                        Initial Stock
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                        Low Stock
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                        Status
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                        Actions
                      </th>

                    </tr>
                  </thead>

                  <tbody>
                    {products.map(
                      (product) => {
                        const isUpdating =
                          updatingId ===
                          product.id;

                        return (
                          <tr
                            key={product.id}
                            className="border-b border-[#f4e8df] last:border-b-0"
                          >

                            <td className="px-6 py-5">
                              <p className="text-sm font-semibold text-[#3b2117]">
                                {product.name}
                              </p>

                              <p className="mt-1 text-xs text-[#8b6b5a]">
                                ID: {product.id}
                              </p>
                            </td>

                            <td className="px-6 py-5 text-sm text-[#5b3928]">
                              {product.code ||
                                "—"}
                            </td>

                            <td className="px-6 py-5 text-sm font-semibold text-[#3b2117]">
                              {product.initialStock.toLocaleString()}
                            </td>

                            <td className="px-6 py-5 text-sm text-[#5b3928]">
                              {product.lowStockThreshold.toLocaleString()}
                            </td>

                            <td className="px-6 py-5">
                              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                                Active
                              </span>
                            </td>

                            <td className="px-6 py-5">
                              <div className="flex justify-end gap-2">

                                <button
                                  type="button"
                                  onClick={() =>
                                    startEdit(
                                      product
                                    )
                                  }
                                  disabled={
                                    isUpdating
                                  }
                                  className="rounded-lg border border-[#e8d4c5] bg-white px-4 py-2 text-xs font-semibold text-[#5b3928] hover:bg-[#fff1e6] disabled:opacity-50"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStatusChange(
                                      product
                                    )
                                  }
                                  disabled={
                                    isUpdating
                                  }
                                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                                >
                                  {isUpdating
                                    ? "Updating..."
                                    : "Deactivate"}
                                </button>

                              </div>
                            </td>

                          </tr>
                        );
                      }
                    )}
                  </tbody>

                </table>
              )}

            </div>
          </section>

        </div>
      </main>
    </div>
  );
}