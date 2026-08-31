"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/src/components/Sidebar";
import { authClient } from "@/src/lib/auth-client";

type Sale = {
  id: string;
  amount: number;
  weight: number;
  quantity: number;
  saleDate: string;
};

type Payment = {
  id: string;
  amount: number;
  paymentDate: string;
  note: string | null;

  createdBy: {
    name: string;
    username: string;
  };
};

type Customer = {
  id: string;
  name: string;
  createdAt: string;

  totalPurchases: number;
  totalPaid: number;
  pendingBalance: number;

  sales: Sale[];
  payments: Payment[];
};

const money = (value: number) =>
  `₹${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function CustomerPage() {
  const router = useRouter();
  const params = useParams();

  const customerId = params.id as string;

  const [customer, setCustomer] =
    useState<Customer | null>(null);

  const [userName, setUserName] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [showPaymentForm, setShowPaymentForm] =
    useState(false);

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [paymentNote, setPaymentNote] =
    useState("");

  const [editingPaymentId, setEditingPaymentId] =
    useState<string | null>(null);

  const [editingPaymentAmount, setEditingPaymentAmount] =
    useState("");

  const [editingPaymentNote, setEditingPaymentNote] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const loadCustomer = useCallback(async () => {
    const response =
      await fetch("/api/customers");

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Failed to load customer."
      );
    }

    const foundCustomer =
      result.find(
        (item: Customer) =>
          item.id === customerId
      );

    if (!foundCustomer) {
      throw new Error(
        "Customer not found."
      );
    }

    setCustomer(foundCustomer);
  }, [customerId]);

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

        if (
          employee.role !== "ADMIN" ||
          employee.status !== "ACTIVE"
        ) {
          router.replace("/dashboard");
          return;
        }

        await loadCustomer();

        setLoading(false);
      } catch (error) {
        console.error(error);

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load customer."
        );

        setLoading(false);
      }
    };

    initialize();
  }, [loadCustomer, router]);

  const handlePayment = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!customer) {
      return;
    }

    setError("");
    setSuccess("");

    const amount =
      Number(paymentAmount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "Enter a valid payment amount."
      );
      return;
    }

    if (
      amount >
      customer.pendingBalance
    ) {
      setError(
        "Payment cannot be greater than the pending balance."
      );
      return;
    }

    setSaving(true);

    try {
      const response =
        await fetch(
          `/api/customers/${customer.id}/payments`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              amount,
              note:
                paymentNote.trim() ||
                null,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Failed to record payment."
        );
        return;
      }

      setSuccess(
        result.remainingBalance === 0
          ? "Payment recorded. Customer balance is now Nil."
          : `Payment recorded. Remaining balance: ${money(
              result.remainingBalance
            )}`
      );

      setPaymentAmount("");
      setPaymentNote("");
      setShowPaymentForm(false);

      await loadCustomer();
    } catch (error) {
      console.error(
        "Payment submission failed:",
        error
      );

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const startEditingPayment = (
    payment: Payment
  ) => {
    setError("");
    setSuccess("");

    setEditingPaymentId(payment.id);
    setEditingPaymentAmount(
      String(payment.amount)
    );
    setEditingPaymentNote(
      payment.note ?? ""
    );

    setShowPaymentForm(false);
  };

  const cancelEditingPayment = () => {
    setEditingPaymentId(null);
    setEditingPaymentAmount("");
    setEditingPaymentNote("");
  };

  const handleEditPayment = async (
    paymentId: string
  ) => {
    if (!customer) {
      return;
    }

    setError("");
    setSuccess("");

    const amount =
      Number(editingPaymentAmount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "Enter a valid payment amount."
      );
      return;
    }

    setSaving(true);

    try {
      const response =
        await fetch(
          `/api/customers/${customer.id}/payments`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              paymentId,
              amount,
              note:
                editingPaymentNote.trim() ||
                null,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Failed to update payment."
        );
        return;
      }

      setSuccess(
        `Payment updated successfully. Remaining balance: ${
          result.pendingBalance === 0
            ? "Nil"
            : money(result.pendingBalance)
        }`
      );

      cancelEditingPayment();

      await loadCustomer();
    } catch (error) {
      console.error(
        "Payment update failed:",
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
          Loading customer...
        </p>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8f2]">
        <div className="text-center">
          <p className="text-red-600">
            {error ||
              "Customer not found."}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push("/customers")
            }
            className="mt-4 rounded-xl bg-[#d96f2b] px-5 py-2 text-sm font-semibold text-white"
          >
            Back to Customers
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#fff8f2]">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <button
                type="button"
                onClick={() =>
                  router.push("/customers")
                }
                className="text-sm font-semibold text-[#a66a4a] hover:text-[#d96f2b]"
              >
                ← Back to Customers
              </button>

              <p className="mt-5 text-sm text-[#a66a4a]">
                Customer Account
              </p>

              <h1 className="mt-2 text-3xl font-bold text-[#3b2117]">
                {customer.name}
              </h1>

              <p className="mt-2 text-[#7b5a49]">
                Complete purchase and payment
                history.
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

          {/* Summary */}
          <div className="mt-8 grid gap-4 md:grid-cols-3">

            <div className="rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">
              <p className="text-sm text-[#8b6b5a]">
                Total Purchases
              </p>

              <p className="mt-2 text-2xl font-bold text-[#3b2117]">
                {money(
                  customer.totalPurchases
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">
              <p className="text-sm text-[#8b6b5a]">
                Total Paid
              </p>

              <p className="mt-2 text-2xl font-bold text-green-700">
                {money(
                  customer.totalPaid
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">
              <p className="text-sm text-[#8b6b5a]">
                Pending Balance
              </p>

              <p
                className={`mt-2 text-2xl font-bold ${
                  customer.pendingBalance === 0
                    ? "text-green-700"
                    : "text-red-600"
                }`}
              >
                {customer.pendingBalance === 0
                  ? "Nil"
                  : money(
                      customer.pendingBalance
                    )}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">

            {/* Sales */}
            <section className="rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#3b2117]">
                Sales
              </h2>

              <p className="mt-1 text-sm text-[#7b5a49]">
                Active purchases made by this
                customer.
              </p>

              {customer.sales.length === 0 ? (
                <div className="mt-6 rounded-xl bg-[#fffaf6] p-6 text-center text-sm text-[#8b6b5a]">
                  No active sales.
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {customer.sales.map(
                    (sale) => (
                      <div
                        key={sale.id}
                        className="rounded-xl border border-[#f1dfd2] bg-[#fffaf6] p-4"
                      >
                        <div className="flex justify-between gap-4">
                          <div>
                            <p className="font-semibold text-[#3b2117]">
                              {sale.quantity}{" "}
                              item
                              {sale.quantity !== 1
                                ? "s"
                                : ""}
                            </p>

                            <p className="mt-1 text-sm text-[#7b5a49]">
                              Weight:{" "}
                              {Number(
                                sale.weight
                              ).toFixed(3)}{" "}
                              kg
                            </p>

                            <p className="mt-1 text-xs text-[#9a7865]">
                              {new Date(
                                sale.saleDate
                              ).toLocaleDateString()}
                            </p>
                          </div>

                          <p className="font-bold text-[#3b2117]">
                            {money(
                              sale.amount
                            )}
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>

            {/* Payments */}
            <section className="rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#3b2117]">
                    Payment History
                  </h2>

                  <p className="mt-1 text-sm text-[#7b5a49]">
                    Payments received from this
                    customer.
                  </p>
                </div>

                {customer.pendingBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setSuccess("");

                      setShowPaymentForm(
                        (value) => !value
                      );

                      cancelEditingPayment();
                    }}
                    className="rounded-xl bg-[#d96f2b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c85f22]"
                  >
                    {showPaymentForm
                      ? "Cancel"
                      : "Add Payment"}
                  </button>
                )}
              </div>

              {/* Add Payment Form */}
              {showPaymentForm && (
                <form
                  onSubmit={handlePayment}
                  className="mt-6 rounded-xl border border-[#f1dfd2] bg-[#fffaf6] p-5"
                >
                  <p className="text-sm font-semibold text-[#5b3928]">
                    Record Payment
                  </p>

                  <p className="mt-1 text-xs text-[#8b6b5a]">
                    Current pending:{" "}
                    <span className="font-bold text-red-600">
                      {money(
                        customer.pendingBalance
                      )}
                    </span>
                  </p>

                  <div className="mt-4">
                    <label
                      htmlFor="payment-amount"
                      className="mb-2 block text-sm font-semibold text-[#5b3928]"
                    >
                      Payment Amount (₹)
                    </label>

                    <input
                      id="payment-amount"
                      type="number"
                      min="0.01"
                      max={
                        customer.pendingBalance
                      }
                      step="0.01"
                      value={paymentAmount}
                      onChange={(event) =>
                        setPaymentAmount(
                          event.target.value
                        )
                      }
                      placeholder="e.g. 5000"
                      required
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    />
                  </div>

                  <div className="mt-4">
                    <label
                      htmlFor="payment-note"
                      className="mb-2 block text-sm font-semibold text-[#5b3928]"
                    >
                      Note
                    </label>

                    <input
                      id="payment-note"
                      type="text"
                      maxLength={500}
                      value={paymentNote}
                      onChange={(event) =>
                        setPaymentNote(
                          event.target.value
                        )
                      }
                      placeholder="Optional note"
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="mt-4 w-full rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#c85f22] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving
                      ? "Saving..."
                      : "Record Payment"}
                  </button>
                </form>
              )}

              {/* Payment History */}
              {customer.payments.length === 0 ? (
                <div className="mt-6 rounded-xl bg-[#fffaf6] p-6 text-center text-sm text-[#8b6b5a]">
                  No payments recorded yet.
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {customer.payments.map(
                    (payment) => {
                      const isEditing =
                        editingPaymentId ===
                        payment.id;

                      return (
                        <div
                          key={payment.id}
                          className="rounded-xl border border-[#f1dfd2] bg-[#fffaf6] p-4"
                        >
                          {isEditing ? (
                            <div>
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-[#5b3928]">
                                  Edit Payment
                                </p>

                                <button
                                  type="button"
                                  onClick={
                                    cancelEditingPayment
                                  }
                                  className="text-sm font-semibold text-[#8b6b5a] hover:text-red-600"
                                >
                                  Cancel
                                </button>
                              </div>

                              <div className="mt-4">
                                <label
                                  htmlFor={`edit-payment-${payment.id}`}
                                  className="mb-2 block text-sm font-semibold text-[#5b3928]"
                                >
                                  Amount (₹)
                                </label>

                                <input
                                  id={`edit-payment-${payment.id}`}
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={
                                    editingPaymentAmount
                                  }
                                  onChange={(event) =>
                                    setEditingPaymentAmount(
                                      event.target.value
                                    )
                                  }
                                  className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                                />
                              </div>

                              <div className="mt-4">
                                <label
                                  htmlFor={`edit-note-${payment.id}`}
                                  className="mb-2 block text-sm font-semibold text-[#5b3928]"
                                >
                                  Note
                                </label>

                                <input
                                  id={`edit-note-${payment.id}`}
                                  type="text"
                                  maxLength={500}
                                  value={
                                    editingPaymentNote
                                  }
                                  onChange={(event) =>
                                    setEditingPaymentNote(
                                      event.target.value
                                    )
                                  }
                                  className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                                />
                              </div>

                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  handleEditPayment(
                                    payment.id
                                  )
                                }
                                className="mt-4 w-full rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#c85f22] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {saving
                                  ? "Saving..."
                                  : "Save Changes"}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-semibold text-green-700">
                                  {money(
                                    payment.amount
                                  )}
                                </p>

                                <p className="mt-1 text-xs text-[#9a7865]">
                                  {new Date(
                                    payment.paymentDate
                                  ).toLocaleDateString()}
                                </p>

                                {payment.note && (
                                  <p className="mt-2 text-sm text-[#7b5a49]">
                                    {payment.note}
                                  </p>
                                )}

                                <p className="mt-2 text-xs text-[#9a7865]">
                                  Recorded by:{" "}
                                  {
                                    payment
                                      .createdBy
                                      .name
                                  }
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                                  PAID
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    startEditingPayment(
                                      payment
                                    )
                                  }
                                  className="rounded-lg border border-[#e8d4c5] bg-white px-3 py-1 text-xs font-semibold text-[#7b4a35] hover:bg-[#fff1e6]"
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
