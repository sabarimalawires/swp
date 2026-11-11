
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/src/components/Sidebar";
import { authClient } from "@/src/lib/auth-client";

type Purchase = {
  id: string;
  invoiceNumber: string | null;
  purchaseDate: string;
  totalAmount: number;
  items: {
    id: string;
    quantity: number | null;
    weight: number;
    rate: number;
    amount: number;
    product: { id: string; name: string; code: string | null };
  }[];
  createdBy?: { name: string; username: string };
};

type Payment = {
  id: string;
  amount: number;
  paymentDate: string;
  note: string | null;
  createdBy: { name: string; username: string };
};

type LedgerEntry = {
  id: string;
  type: "PURCHASE" | "PAYMENT";
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstNumber: string | null;
  createdAt: string;
};

type SupplierData = {
  supplier: Supplier;
  purchases: Purchase[];
  payments: Payment[];
  totalPurchases: number;
  totalPaid: number;
  pendingBalance: number;
  supplierCredit: number;
  ledger: LedgerEntry[];
};

const money = (value: number) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const today = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const formatDate = (value: string) => {
  const date = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "—";
};

export default function SupplierPage() {
  const router = useRouter();
  const params = useParams();
  const supplierId = params.id as string;

  const [data, setData] = useState<SupplierData | null>(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    gstNumber: "",
  });

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentNote, setPaymentNote] = useState("");

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState("");
  const [editingDate, setEditingDate] = useState("");
  const [editingNote, setEditingNote] = useState("");

  const loadSupplier = async () => {
    const response = await fetch(`/api/suppliers/${supplierId}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to load supplier.");
    }

    setData(result);
    return result as SupplierData;
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: session } = await authClient.getSession();

        if (!session?.user) {
          router.replace("/");
          return;
        }

        setUserName(session.user.name);

        const employeeResponse = await fetch("/api/me/employee");

        if (!employeeResponse.ok) {
          router.replace("/dashboard");
          return;
        }

        const employee = await employeeResponse.json();

        if (
          employee.role !== "ADMIN" ||
          employee.status !== "ACTIVE"
        ) {
          router.replace("/dashboard");
          return;
        }

        await loadSupplier();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load supplier."
        );
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [supplierId, router]);

  const updateProfileField = (field: keyof typeof profile, value: string) => {
    setProfile((previous) => ({ ...previous, [field]: value }));
  };

  const startProfileEdit = () => {
    if (!data) return;

    setProfile({
      name: data.supplier.name,
      phone: data.supplier.phone || "",
      email: data.supplier.email || "",
      address: data.supplier.address || "",
      gstNumber: data.supplier.gstNumber || "",
    });

    setShowProfileForm(true);
    setError("");
    setSuccess("");
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;

    setError("");
    setSuccess("");

    if (!profile.name.trim()) {
      setError("Supplier name is required.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/suppliers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: supplierId,
          name: profile.name.trim(),
          phone: profile.phone.trim() || null,
          email: profile.email.trim() || null,
          address: profile.address.trim() || null,
          gstNumber: profile.gstNumber.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update supplier.");
      }

      await loadSupplier();
      setShowProfileForm(false);
      setSuccess("Supplier details updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const submitPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const amount = Number(paymentAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/suppliers/${supplierId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          paymentDate,
          note: paymentNote.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to record payment.");
      }

      await loadSupplier();

      setPaymentAmount("");
      setPaymentDate(today());
      setPaymentNote("");
      setShowPaymentForm(false);

      setSuccess(
        result.supplierCredit > 0
          ? `Payment recorded. Supplier credit: ${money(result.supplierCredit)}`
          : result.pendingBalance > 0
            ? `Payment recorded. Remaining balance: ${money(result.pendingBalance)}`
            : "Payment recorded successfully. Balance is Nil."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
    } finally {
      setSaving(false);
    }
  };

  const startEditingPayment = (payment: Payment) => {
    setEditingPaymentId(payment.id);
    setEditingAmount(String(payment.amount));
    setEditingDate(String(payment.paymentDate).slice(0, 10));
    setEditingNote(payment.note || "");
    setError("");
    setSuccess("");
    setShowPaymentForm(false);
  };

  const cancelEditingPayment = () => {
    setEditingPaymentId(null);
    setEditingAmount("");
    setEditingDate("");
    setEditingNote("");
  };

  const savePaymentEdit = async (paymentId: string) => {
    const amount = Number(editingAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/suppliers/${supplierId}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
          amount,
          paymentDate: editingDate,
          note: editingNote.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update payment.");
      }

      await loadSupplier();
      cancelEditingPayment();
      setSuccess("Payment updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment update failed.");
    } finally {
      setSaving(false);
    }
  };

  const deletePayment = async (paymentId: string) => {
    if (!window.confirm("Are you sure you want to delete this payment?")) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/suppliers/${supplierId}/payments?paymentId=${encodeURIComponent(paymentId)}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete payment.");
      }

      await loadSupplier();
      cancelEditingPayment();
      setSuccess("Payment deleted successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8f2]">
        <p className="text-[#0B3829]">Loading supplier account...</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8f2]">
        <div className="text-center">
          <p className="text-red-600">{error || "Supplier not found."}</p>
          <button
            onClick={() => router.push("/suppliers")}
            className="mt-4 rounded-xl bg-[#0B3829] px-5 py-2 text-[#F2EAD2]"
          >
            Back to Suppliers
          </button>
        </div>
      </main>
    );
  }

  const { supplier, purchases, payments, ledger } = data;

  return (
    <div className="flex min-h-screen min-w-0 bg-[#fff8f2]">
      <Sidebar />

      <main className="min-w-0 flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button
                onClick={() => router.push("/suppliers")}
                className="text-sm font-semibold text-[#718477] hover:text-[#0B3829]"
              >
                ← Back to Suppliers
              </button>

              <p className="mt-5 text-sm text-[#718477]">
                Supplier Account
              </p>

              <h1 className="mt-2 text-3xl font-bold text-[#0B3829]">
                {supplier.name}
              </h1>

              <p className="mt-2 text-sm text-[#7b5a49]">
                Mobile: {supplier.phone || "Not provided"}
                {" · "}
                GST: {supplier.gstNumber || "Not provided"}
              </p>

              <button
                onClick={startProfileEdit}
                className="mt-4 rounded-xl border border-[#e5cdbd] px-4 py-2 text-sm font-semibold text-[#5b3928] hover:bg-[#E5E9DA]"
              >
                Edit Supplier
              </button>
            </div>

            <div className="rounded-xl bg-[#E5E9DA] px-4 py-3">
              <p className="text-xs text-[#718477]">Signed in as</p>
              <p className="font-semibold text-[#0B3829]">{userName}</p>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          {showProfileForm && (
            <section className="mt-6 rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#0B3829]">
                Edit Supplier Details
              </h2>

              <form onSubmit={saveProfile} className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {(
                    [
                      ["name", "Supplier Name"],
                      ["phone", "Mobile Number"],
                      ["email", "Email Address"],
                      ["gstNumber", "GST Number"],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label className="mb-1 block text-sm font-medium text-[#5b3928]">
                        {label}
                      </label>
                      <input
                        value={profile[field]}
                        onChange={(event) =>
                          updateProfileField(field, event.target.value)
                        }
                        className="w-full rounded-xl border border-[#e5cdbd] px-4 py-3 text-[#0B3829] outline-none focus:border-[#0B3829]"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#5b3928]">
                    Address
                  </label>
                  <textarea
                    rows={3}
                    value={profile.address}
                    onChange={(event) =>
                      updateProfileField("address", event.target.value)
                    }
                    className="w-full rounded-xl border border-[#e5cdbd] px-4 py-3 text-[#0B3829] outline-none focus:border-[#0B3829]"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    disabled={saving}
                    className="rounded-xl bg-[#0B3829] px-5 py-2.5 text-sm font-semibold text-[#F2EAD2] disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProfileForm(false)}
                    className="rounded-xl border border-[#e5cdbd] px-5 py-2.5 text-sm font-semibold text-[#5b3928]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-5 shadow-sm">
              <p className="text-sm text-[#8b6b5a]">Total Purchases</p>
              <p className="mt-2 text-2xl font-bold text-[#0B3829]">
                {money(data.totalPurchases)}
              </p>
            </div>

            <div className="rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-5 shadow-sm">
              <p className="text-sm text-[#8b6b5a]">Total Paid</p>
              <p className="mt-2 text-2xl font-bold text-green-700">
                {money(data.totalPaid)}
              </p>
            </div>

            <div className="rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-5 shadow-sm">
              <p className="text-sm text-[#8b6b5a]">Pending Balance</p>
              <p className="mt-2 text-2xl font-bold text-red-600">
                {money(data.pendingBalance)}
              </p>
            </div>

            <div className="rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-5 shadow-sm">
              <p className="text-sm text-[#8b6b5a]">Supplier Credit</p>
              <p className="mt-2 text-2xl font-bold text-blue-700">
                {money(data.supplierCredit)}
              </p>
            </div>
          </div>

          <section className="mt-8 rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#0B3829]">
                  Supplier Payments
                </h2>
                <p className="mt-1 text-sm text-[#7b5a49]">
                  Record payments made to this supplier.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowPaymentForm((value) => !value);
                  cancelEditingPayment();
                  setError("");
                }}
                className="rounded-xl bg-[#0B3829] px-4 py-2.5 text-sm font-semibold text-[#F2EAD2] hover:bg-[#365B49]"
              >
                {showPaymentForm ? "Cancel" : "+ Record Payment"}
              </button>
            </div>

            {showPaymentForm && (
              <form
                onSubmit={submitPayment}
                className="mt-5 rounded-xl bg-[#fffaf6] p-5"
              >
                <h3 className="font-semibold text-[#0B3829]">
                  Record New Payment
                </h3>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm text-[#5b3928]">
                      Amount *
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder="Enter amount"
                      className="w-full rounded-xl border border-[#e5cdbd] bg-[#F2EAD2] px-4 py-3 text-[#0B3829]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-[#5b3928]">
                      Payment Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(event) => setPaymentDate(event.target.value)}
                      className="w-full rounded-xl border border-[#e5cdbd] bg-[#F2EAD2] px-4 py-3 text-[#0B3829]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-[#5b3928]">
                      Note
                    </label>
                    <input
                      value={paymentNote}
                      onChange={(event) => setPaymentNote(event.target.value)}
                      maxLength={500}
                      placeholder="Optional note"
                      className="w-full rounded-xl border border-[#e5cdbd] bg-[#F2EAD2] px-4 py-3 text-[#0B3829]"
                    />
                  </div>
                </div>

                <button
                  disabled={saving}
                  className="mt-4 rounded-xl bg-[#0B3829] px-5 py-2.5 text-sm font-semibold text-[#F2EAD2] disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Payment"}
                </button>
              </form>
            )}

            {payments.length === 0 ? (
              <p className="mt-6 rounded-xl bg-[#fffaf6] p-6 text-center text-sm text-[#8b6b5a]">
                No payments recorded yet.
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#ead8c9] text-left text-xs uppercase text-[#8b6b5a]">
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3">Amount</th>
                      <th className="px-3 py-3">Note</th>
                      <th className="px-3 py-3">Recorded By</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr
                        key={payment.id}
                        className="border-b border-[#f3e5db] last:border-0"
                      >
                        <td className="px-3 py-4 text-sm text-[#5b3928]">
                          {formatDate(payment.paymentDate)}
                        </td>
                        <td className="px-3 py-4 font-semibold text-green-700">
                          {money(payment.amount)}
                        </td>
                        <td className="px-3 py-4 text-sm text-[#7b5a49]">
                          {payment.note || "—"}
                        </td>
                        <td className="px-3 py-4 text-sm text-[#7b5a49]">
                          {payment.createdBy?.name || "—"}
                        </td>
                        <td className="px-3 py-4">
                          {editingPaymentId === payment.id ? (
                            <div className="min-w-56 space-y-2">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={editingAmount}
                                onChange={(event) =>
                                  setEditingAmount(event.target.value)
                                }
                                className="w-full rounded-lg border border-[#e5cdbd] px-3 py-2"
                              />
                              <input
                                type="date"
                                value={editingDate}
                                onChange={(event) =>
                                  setEditingDate(event.target.value)
                                }
                                className="w-full rounded-lg border border-[#e5cdbd] px-3 py-2"
                              />
                              <input
                                value={editingNote}
                                onChange={(event) =>
                                  setEditingNote(event.target.value)
                                }
                                placeholder="Note"
                                className="w-full rounded-lg border border-[#e5cdbd] px-3 py-2"
                              />
                              <div className="flex gap-2">
                                <button
                                  disabled={saving}
                                  onClick={() => savePaymentEdit(payment.id)}
                                  className="rounded-lg bg-[#0B3829] px-3 py-2 text-xs font-semibold text-[#F2EAD2]"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={cancelEditingPayment}
                                  className="rounded-lg border px-3 py-2 text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                disabled={saving}
                                onClick={() => startEditingPayment(payment)}
                                className="rounded-lg border border-[#e5cdbd] px-3 py-2 text-xs font-semibold text-[#5b3928]"
                              >
                                Edit
                              </button>
                              <button
                                disabled={saving}
                                onClick={() => deletePayment(payment.id)}
                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-8 rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0B3829]">
              Supplier Ledger
            </h2>
            <p className="mt-1 text-sm text-[#7b5a49]">
              Purchases are credits; payments are debits. Running balance shows
              the amount owed to the supplier.
            </p>

            {ledger.length === 0 ? (
              <p className="mt-6 rounded-xl bg-[#fffaf6] p-6 text-center text-sm text-[#8b6b5a]">
                No ledger entries yet.
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#ead8c9] text-left text-xs uppercase text-[#8b6b5a]">
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3">Description</th>
                      <th className="px-3 py-3">Debit</th>
                      <th className="px-3 py-3">Credit</th>
                      <th className="px-3 py-3">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((entry) => (
                      <tr
                        key={`${entry.type}-${entry.id}`}
                        className="border-b border-[#f3e5db] last:border-0"
                      >
                        <td className="px-3 py-4 text-sm text-[#5b3928]">
                          {formatDate(entry.date)}
                        </td>
                        <td className="px-3 py-4 text-sm text-[#0B3829]">
                          {entry.description}
                        </td>
                        <td className="px-3 py-4 text-sm font-semibold text-green-700">
                          {entry.debit > 0 ? money(entry.debit) : "—"}
                        </td>
                        <td className="px-3 py-4 text-sm font-semibold text-[#0B3829]">
                          {entry.credit > 0 ? money(entry.credit) : "—"}
                        </td>
                        <td className="px-3 py-4 text-sm font-bold text-[#0B3829]">
                          {money(entry.balance)}
                          {entry.balance < 0 && (
                            <span className="ml-1 text-xs text-blue-700">
                              (Credit)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-6 border-t border-[#ead8c9] pt-5 text-sm">
              <p className="text-[#5b3928]">
                Total Debit:{" "}
                <strong className="text-green-700">
                  {money(data.totalPaid)}
                </strong>
              </p>
              <p className="text-[#5b3928]">
                Total Credit:{" "}
                <strong className="text-[#0B3829]">
                  {money(data.totalPurchases)}
                </strong>
              </p>
              <p className="text-[#5b3928]">
                Net Balance:{" "}
                <strong className="text-[#0B3829]">
                  {money(data.totalPurchases - data.totalPaid)}
                </strong>
              </p>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0B3829]">
              Purchase History
            </h2>
            <p className="mt-1 text-sm text-[#7b5a49]">
              All active purchases recorded for this supplier.
            </p>

            {purchases.length === 0 ? (
              <p className="mt-6 rounded-xl bg-[#fffaf6] p-6 text-center text-sm text-[#8b6b5a]">
                No purchases recorded yet.
              </p>
            ) : (
              <div className="mt-5 space-y-4">
                {purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="rounded-xl border border-[#D5CBB3] p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0B3829]">
                          {purchase.invoiceNumber
                            ? `Invoice ${purchase.invoiceNumber}`
                            : "Purchase"}
                        </p>
                        <p className="mt-1 text-xs text-[#8b6b5a]">
                          {formatDate(purchase.purchaseDate)}
                        </p>
                      </div>
                      <p className="font-bold text-[#0B3829]">
                        {money(purchase.totalAmount)}
                      </p>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#ead8c9] text-left text-xs text-[#8b6b5a]">
                            <th className="py-2">Product</th>
                            <th className="py-2">Quantity</th>
                            <th className="py-2">Weight (kg)</th>
                            <th className="py-2">Rate/kg</th>
                            <th className="py-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchase.items.map((item) => (
                            <tr key={item.id} className="border-b border-[#f3e5db]">
                              <td className="py-3 text-[#0B3829]">
                                {item.product.name}
                                {item.product.code && (
                                  <span className="ml-2 text-xs text-[#9a7865]">
                                    ({item.product.code})
                                  </span>
                                )}
                              </td>
                              <td className="py-3 text-[#5b3928]">
                                {item.quantity ?? "—"}
                              </td>
                              <td className="py-3 text-[#5b3928]">
                                {Number(item.weight).toFixed(3)}
                              </td>
                              <td className="py-3 text-[#5b3928]">
                                {money(item.rate)}
                              </td>
                              <td className="py-3 font-semibold text-[#0B3829]">
                                {money(item.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
