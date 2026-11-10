
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";
import Sidebar from "@/src/components/Sidebar";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstNumber: string | null;
  createdAt: string;
  totalPurchases: number;
  totalPaid: number;
  pendingBalance: number;
  supplierCredit: number;
  netBalance: number;
  purchasesCount: number;
  paymentsCount: number;
};

const money = (value: number) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function SuppliersPage() {
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [userName, setUserName] = useState("");

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    gstNumber: "",
  });

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const loadSuppliers = async () => {
    try {
      setError("");
      const response = await fetch("/api/suppliers");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load suppliers.");
      }

      setSuppliers(Array.isArray(result) ? result : result.suppliers || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load suppliers."
      );
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const { data } = await authClient.getSession();

        if (!data?.user) {
          router.replace("/");
          return;
        }

        setUserName(data.user.name);

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

        await loadSuppliers();
      } catch {
        router.replace("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [router]);

  const openAddForm = () => {
    setEditingId(null);
    setForm({
      name: "",
      phone: "",
      email: "",
      address: "",
      gstNumber: "",
    });
    setFormError("");
    setShowForm(true);
    setSuccess("");
  };

  const openEditForm = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      gstNumber: supplier.gstNumber || "",
    });
    setFormError("");
    setShowForm(true);
    setSuccess("");
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (!form.name.trim()) {
      setFormError("Supplier name is required.");
      return;
    }

    if (
      form.phone.trim() &&
      !/^[0-9+\-\s()]{7,20}$/.test(form.phone.trim())
    ) {
      setFormError("Enter a valid mobile number.");
      return;
    }

    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      setFormError("Enter a valid email address.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/suppliers", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          gstNumber: form.gstNumber.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save supplier.");
      }

      await loadSuppliers();
      setShowForm(false);
      setEditingId(null);
      setSuccess(
        editingId
          ? "Supplier details updated successfully."
          : "Supplier created successfully."
      );
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to save supplier."
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const term = search.toLowerCase();

    return (
      supplier.name.toLowerCase().includes(term) ||
      (supplier.phone || "").toLowerCase().includes(term) ||
      (supplier.email || "").toLowerCase().includes(term) ||
      (supplier.gstNumber || "").toLowerCase().includes(term)
    );
  });

  const totalPurchases = suppliers.reduce(
    (sum, supplier) => sum + Number(supplier.totalPurchases || 0),
    0
  );

  const totalPaid = suppliers.reduce(
    (sum, supplier) => sum + Number(supplier.totalPaid || 0),
    0
  );

  const totalPending = suppliers.reduce(
    (sum, supplier) => sum + Number(supplier.pendingBalance || 0),
    0
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8f2]">
        <p className="text-[#1E3B2F]">Loading suppliers...</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#fff8f2]">
      <Sidebar />

      <main className="min-w-0 flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-[#718477]">
                SWP Business Management System
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#1E3B2F]">
                Suppliers
              </h1>
              <p className="mt-2 text-[#7b5a49]">
                Manage suppliers, purchases, payments and outstanding balances.
              </p>
            </div>

            <div className="rounded-xl bg-[#E5E9DA] px-4 py-3">
              <p className="text-xs text-[#718477]">Signed in as</p>
              <p className="font-semibold text-[#1E3B2F]">{userName}</p>
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

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-5 shadow-sm">
              <p className="text-sm text-[#8b6b5a]">Total Suppliers</p>
              <p className="mt-2 text-2xl font-bold text-[#1E3B2F]">
                {suppliers.length}
              </p>
            </div>

            <div className="rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-5 shadow-sm">
              <p className="text-sm text-[#8b6b5a]">Total Purchases</p>
              <p className="mt-2 text-2xl font-bold text-[#1E3B2F]">
                ₹{money(totalPurchases)}
              </p>
            </div>

            <div className="rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-5 shadow-sm">
              <p className="text-sm text-[#8b6b5a]">Total Paid</p>
              <p className="mt-2 text-2xl font-bold text-green-700">
                ₹{money(totalPaid)}
              </p>
            </div>

            <div className="rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-5 shadow-sm">
              <p className="text-sm text-[#8b6b5a]">Total Pending</p>
              <p className="mt-2 text-2xl font-bold text-red-600">
                ₹{money(totalPending)}
              </p>
            </div>
          </div>

          {showForm && (
            <div className="mt-8 rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#1E3B2F]">
                {editingId ? "Edit Supplier" : "Add Supplier"}
              </h2>

              {formError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSave} className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {(
                    [
                      ["name", "Supplier Name *", "Enter supplier name"],
                      ["phone", "Mobile Number", "Enter mobile number"],
                      ["email", "Email Address", "Enter email address"],
                      ["gstNumber", "GST Number", "Enter GST number"],
                    ] as const
                  ).map(([field, label, placeholder]) => (
                    <div key={field}>
                      <label className="mb-1 block text-sm font-medium text-[#5b3928]">
                        {label}
                      </label>
                      <input
                        type="text"
                        value={form[field]}
                        onChange={(event) =>
                          updateField(field, event.target.value)
                        }
                        maxLength={field === "name" ? 200 : 200}
                        required={field === "name"}
                        placeholder={placeholder}
                        className="w-full rounded-xl border border-[#e5cdbd] px-4 py-3 text-[#1E3B2F] outline-none focus:border-[#1E3B2F]"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#5b3928]">
                    Address
                  </label>
                  <textarea
                    value={form.address}
                    onChange={(event) =>
                      updateField("address", event.target.value)
                    }
                    rows={3}
                    maxLength={1000}
                    placeholder="Enter supplier address"
                    className="w-full rounded-xl border border-[#e5cdbd] px-4 py-3 text-[#1E3B2F] outline-none focus:border-[#1E3B2F]"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-[#1E3B2F] px-5 py-2.5 text-sm font-semibold text-[#F2EAD2] hover:bg-[#c85f22] disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : editingId
                        ? "Save Changes"
                        : "Create Supplier"}
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setShowForm(false)}
                    className="rounded-xl border border-[#e5cdbd] px-5 py-2.5 text-sm font-semibold text-[#5b3928] hover:bg-[#E5E9DA]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-[#D5CBB3] bg-[#F2EAD2] p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#1E3B2F]">
                  Supplier Directory
                </h2>
                <p className="mt-1 text-sm text-[#7b5a49]">
                  Open a supplier to view purchases, payments and ledger.
                </p>
              </div>

              <button
                type="button"
                onClick={openAddForm}
                className="rounded-xl bg-[#1E3B2F] px-4 py-2.5 text-sm font-semibold text-[#F2EAD2] hover:bg-[#c85f22]"
              >
                + Add Supplier
              </button>
            </div>

            <div className="mt-5">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by supplier name, phone, email or GST..."
                className="w-full rounded-xl border border-[#e5cdbd] px-4 py-3 text-sm text-[#1E3B2F] outline-none focus:border-[#1E3B2F]"
              />
            </div>

            {filteredSuppliers.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-[#e5cdbd] bg-[#fffaf6] p-10 text-center">
                <p className="font-medium text-[#1E3B2F]">
                  {search ? "No matching suppliers found." : "No suppliers yet."}
                </p>
                <p className="mt-2 text-sm text-[#8b6b5a]">
                  Add a supplier to start recording purchases.
                </p>
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#ead8c9] text-left text-xs uppercase tracking-wide text-[#8b6b5a]">
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Purchases</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Balance</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSuppliers.map((supplier) => (
                      <tr
                        key={supplier.id}
                        className="border-b border-[#f3e5db] last:border-0 hover:bg-[#fffaf6]"
                      >
                        <td className="px-4 py-4">
                          <p className="font-semibold text-[#1E3B2F]">
                            {supplier.name}
                          </p>
                          <p className="mt-1 text-xs text-[#9a7865]">
                            {supplier.phone || "No phone number"}
                          </p>
                          {supplier.gstNumber && (
                            <p className="mt-1 text-xs text-[#9a7865]">
                              GST: {supplier.gstNumber}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm text-[#5b3928]">
                          {supplier.purchasesCount}
                        </td>

                        <td className="px-4 py-4 text-sm font-semibold text-[#1E3B2F]">
                          ₹{money(supplier.totalPurchases)}
                        </td>

                        <td className="px-4 py-4 text-sm font-semibold text-green-700">
                          ₹{money(supplier.totalPaid)}
                        </td>

                        <td className="px-4 py-4">
                          {Number(supplier.supplierCredit) > 0 ? (
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                              +₹{money(supplier.supplierCredit)} Credit
                            </span>
                          ) : Number(supplier.pendingBalance) > 0 ? (
                            <span className="font-bold text-red-600">
                              ₹{money(supplier.pendingBalance)}
                            </span>
                          ) : (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                              Nil
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/suppliers/${supplier.id}`)
                              }
                              className="rounded-xl bg-[#1E3B2F] px-4 py-2 text-sm font-semibold text-[#F2EAD2] hover:bg-[#c85f22]"
                            >
                              Open
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditForm(supplier)}
                              className="rounded-xl border border-[#e5cdbd] px-3 py-2 text-sm font-semibold text-[#5b3928] hover:bg-[#E5E9DA]"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
