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

type Payment = {
  id: string;
  amount: number;
  paymentDate: string;
  note?: string | null;
};

type Sale = {
  id: string;
  quantity: number;
  weight: number;
  amount: number;
  totalPaid: number;
  balance: number;
  saleDate: string;
  status: "ACTIVE" | "VOIDED";

  customer: {
    id: string;
    name: string;
  };

  product: Product;

  createdBy: {
    name: string;
    username: string;
  };

  payments: Payment[];
};

export default function SalesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState<
    "ADMIN" | "WORKER" | null
  >(null);

  const [products, setProducts] = useState<
    InventoryItem[]
  >([]);

  const [sales, setSales] = useState<Sale[]>([]);

  const [customerName, setCustomerName] =
    useState("");

  const [productId, setProductId] =
    useState("");

  const [quantity, setQuantity] =
    useState("");

  /*
   * Weight is entered and stored in KILOGRAMS.
   * Example:
   * 0.015 kg
   * 1.250 kg
   * 10.500 kg
   */
  const [weight, setWeight] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [initialPayment, setInitialPayment] =
    useState("");

  const [saleDate, setSaleDate] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = async () => {
    try {
      const [
        inventoryResponse,
        salesResponse,
      ] = await Promise.all([
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

      setError(
        "Failed to load sales data."
      );
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

        const employeeResponse =
          await fetch(
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
         */
        if (employee.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }

        setRole(employee.role);

        await loadData();

        const today =
          new Date()
            .toISOString()
            .split("T")[0];

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

  const selectedProduct =
    products.find(
      (product) =>
        product.id === productId
    );

  const numericAmount =
    Number(amount) || 0;

  const numericInitialPayment =
    Number(initialPayment) || 0;

  const calculatedBalance =
    Math.max(
      0,
      numericAmount -
        numericInitialPayment
    );

  const handleVoidSale = async (
    saleId: string
  ) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to void this sale?"
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response =
        await fetch(
          `/api/sales/${saleId}/void`,
          {
            method: "POST",
          }
        );

      const result =
        await response.json();

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

    const parsedQuantity =
      Number(quantity);

    const parsedWeight =
      Number(weight);

    const parsedAmount =
      Number(amount);

    const parsedPayment =
      Number(initialPayment || 0);

    if (!customerName.trim()) {
      setError(
        "Customer name is required."
      );
      return;
    }

    if (
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity <= 0
    ) {
      setError(
        "Quantity must be a whole number greater than 0."
      );
      return;
    }

    if (
      !Number.isFinite(parsedWeight) ||
      parsedWeight <= 0
    ) {
      setError(
        "Weight must be greater than 0 kg."
      );
      return;
    }

    if (
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setError(
        "Amount must be greater than ₹0."
      );
      return;
    }

    if (
      !Number.isFinite(parsedPayment) ||
      parsedPayment < 0
    ) {
      setError(
        "Initial payment cannot be negative."
      );
      return;
    }

    if (
      parsedPayment > parsedAmount
    ) {
      setError(
        "Initial payment cannot be greater than the sale amount."
      );
      return;
    }

    if (!productId) {
      setError(
        "Please select a product."
      );
      return;
    }

    if (!saleDate) {
      setError(
        "Sale date is required."
      );
      return;
    }

    setSaving(true);

    try {
      const response =
        await fetch(
          "/api/sales",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              customerName:
                customerName.trim(),

              productId,

              quantity:
                parsedQuantity,

              /*
               * Weight is sent directly in kg.
               */
              weight:
                parsedWeight,

              amount:
                parsedAmount,

              initialPayment:
                parsedPayment,

              saleDate,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Failed to create sale."
        );
        return;
      }

      const pending =
        Math.max(
          0,
          parsedAmount -
            parsedPayment
        );

      setSuccess(
        `Sale created successfully. ${
          pending > 0
            ? `₹${pending.toFixed(
                2
              )} pending.`
            : "Fully paid."
        }`
      );

      setCustomerName("");
      setProductId("");
      setQuantity("");
      setWeight("");
      setAmount("");
      setInitialPayment("");

      await loadData();
    } catch (error) {
      console.error(
        "Sale creation failed:",
        error
      );

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
        <div className="mx-auto max-w-7xl">

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
                Record sales, payments and
                customer balances.
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

          <div className="mt-8 grid gap-6 lg:grid-cols-[400px_1fr]">

            {/* Create Sale */}
            <div className="rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">

              <h2 className="text-lg font-semibold text-[#3b2117]">
                Create Sale
              </h2>

              <p className="mt-1 text-sm text-[#7b5a49]">
                Record the sale and initial payment.
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

                    {products.map(
                      (product) => (
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
                          — Stock:{" "}
                          {product.stock}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* Stock */}
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
                      {
                        selectedProduct.stock
                      }
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

                {/* Weight in KG */}
                <div>
                  <label
                    htmlFor="sale-weight"
                    className="mb-2 block text-sm font-semibold text-[#5b3928]"
                  >
                    Weight (kg)
                  </label>

                  <input
                    id="sale-weight"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={weight}
                    onChange={(event) =>
                      setWeight(
                        event.target.value
                      )
                    }
                    placeholder="e.g. 1.250"
                    required
                    className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                  />

                  <p className="mt-1 text-xs text-[#9a7865]">
                    Enter the total sale weight in kilograms.
                  </p>
                </div>

                {/* Amount */}
                <div>
                  <label
                    htmlFor="sale-amount"
                    className="mb-2 block text-sm font-semibold text-[#5b3928]"
                  >
                    Total Amount (₹)
                  </label>

                  <input
                    id="sale-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) =>
                      setAmount(
                        event.target.value
                      )
                    }
                    placeholder="e.g. 10000"
                    required
                    className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                  />
                </div>

                {/* Initial Payment */}
                <div>
                  <label
                    htmlFor="initial-payment"
                    className="mb-2 block text-sm font-semibold text-[#5b3928]"
                  >
                    Paid Now (₹)
                  </label>

                  <input
                    id="initial-payment"
                    type="number"
                    min="0"
                    step="0.01"
                    max={
                      numericAmount ||
                      undefined
                    }
                    value={initialPayment}
                    onChange={(event) =>
                      setInitialPayment(
                        event.target.value
                      )
                    }
                    placeholder="e.g. 5000"
                    className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                  />
                </div>

                {/* Balance Preview */}
                <div className="rounded-xl bg-[#fff7ed] p-4">

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#7b5a49]">
                      Total
                    </span>

                    <span className="font-semibold text-[#3b2117]">
                      ₹
                      {numericAmount.toFixed(
                        2
                      )}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-[#7b5a49]">
                      Paid now
                    </span>

                    <span className="font-semibold text-green-700">
                      ₹
                      {numericInitialPayment.toFixed(
                        2
                      )}
                    </span>
                  </div>

                  <div className="mt-3 border-t border-[#ead8c9] pt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#5b3928]">
                        Pending
                      </span>

                      <span
                        className={`font-bold ${
                          calculatedBalance ===
                          0
                            ? "text-green-700"
                            : "text-red-600"
                        }`}
                      >
                        {calculatedBalance ===
                        0
                          ? "Nil"
                          : `₹${calculatedBalance.toFixed(
                              2
                            )}`}
                      </span>
                    </div>
                  </div>
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
                    Recent sales and customer balances.
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

                      <div className="flex flex-col gap-4">

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                          <div>
                            <p className="font-semibold text-[#3b2117]">
                              {sale.product.name}
                            </p>

                            <p className="mt-1 text-sm font-semibold text-[#5b3928]">
                              Customer:{" "}
                              {sale.customer.name}
                            </p>

                            <p className="mt-1 text-sm text-[#7b5a49]">
                              Quantity:{" "}
                              {sale.quantity}
                            </p>

                            <p className="mt-1 text-sm text-[#7b5a49]">
                              Weight:{" "}
                              {Number(
                                sale.weight
                              ).toFixed(3)}{" "}
                              kg
                            </p>

                            <p className="mt-1 text-sm text-[#7b5a49]">
                              Amount: ₹
                              {Number(
                                sale.amount
                              ).toFixed(2)}
                            </p>

                            <p className="mt-1 text-sm text-green-700">
                              Paid: ₹
                              {Number(
                                sale.totalPaid
                              ).toFixed(2)}
                            </p>

                            <p
                              className={`mt-1 text-sm font-bold ${
                                Number(
                                  sale.balance
                                ) === 0
                                  ? "text-green-700"
                                  : "text-red-600"
                              }`}
                            >
                              Pending:{" "}
                              {Number(
                                sale.balance
                              ) === 0
                                ? "Nil"
                                : `₹${Number(
                                    sale.balance
                                  ).toFixed(2)}`}
                            </p>

                            <p className="mt-2 text-xs text-[#9a7865]">
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
                                sale.status ===
                                "ACTIVE"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {sale.status}
                            </span>

                            {role ===
                              "ADMIN" &&
                              sale.status ===
                                "ACTIVE" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleVoidSale(
                                      sale.id
                                    )
                                  }
                                  disabled={
                                    saving
                                  }
                                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Void
                                </button>
                              )}
                          </div>
                        </div>

                        {/* Payment History */}
                        {sale.payments.length >
                          0 && (
                          <div className="border-t border-[#ead8c9] pt-3">

                            <p className="text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                              Payment History
                            </p>

                            <div className="mt-2 space-y-1">
                              {sale.payments.map(
                                (payment) => (
                                  <div
                                    key={
                                      payment.id
                                    }
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span className="text-[#7b5a49]">
                                      {new Date(
                                        payment.paymentDate
                                      ).toLocaleDateString()}
                                    </span>

                                    <span className="font-semibold text-green-700">
                                      ₹
                                      {Number(
                                        payment.amount
                                      ).toFixed(2)}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
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