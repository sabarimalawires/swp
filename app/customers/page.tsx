"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";
import Sidebar from "@/src/components/Sidebar";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;

  totalPurchases: number;
  totalPaid: number;
  pendingBalance: number;
  salesCount: number;
};

export default function CustomersPage() {
  const router = useRouter();

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [userName, setUserName] =
    useState("");

  
const [showCustomerForm, setShowCustomerForm] =
  useState(false);

const [editingCustomerId, setEditingCustomerId] =
  useState<string | null>(null);

const [formName, setFormName] =
  useState("");

const [formPhone, setFormPhone] =
  useState("");

const [savingCustomer, setSavingCustomer] =
  useState(false);

const [formError, setFormError] =
  useState("");

const [formSuccess, setFormSuccess] =
  useState("");


  const loadCustomers = async () => {
    try {
      setError("");

      const response =
        await fetch("/api/customers");

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to load customers."
        );
      }

      setCustomers(result);
    } catch (error) {
      console.error(
        "Customer loading failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to load customers."
      );
    }
  };

  
const openAddCustomerForm = () => {
  setEditingCustomerId(null);
  setFormName("");
  setFormPhone("");
  setFormError("");
  setFormSuccess("");
  setError("");
  setShowCustomerForm(true);
};

const openEditCustomerForm = (customer: Customer) => {
  setEditingCustomerId(customer.id);
  setFormName(customer.name);
  setFormPhone(customer.phone ?? "");
  setFormError("");
  setFormSuccess("");
  setError("");
  setShowCustomerForm(true);
};

const handleSaveCustomer = async (
  event: React.FormEvent<HTMLFormElement>
) => {
  event.preventDefault();

  setFormError("");
  setFormSuccess("");

  const name = formName.trim();
  const phone = formPhone.trim();

  if (!name) {
    setFormError("Customer name is required.");
    return;
  }

  if (name.length > 200) {
    setFormError(
      "Customer name must be 200 characters or less."
    );
    return;
  }

  if (
    phone &&
    !/^[0-9+\-\s()]{7,20}$/.test(phone)
  ) {
    setFormError("Enter a valid mobile number.");
    return;
  }

  setSavingCustomer(true);

  try {
    const isEditing = editingCustomerId !== null;

    const url = isEditing
      ? `/api/customers/${editingCustomerId}/profile`
      : "/api/customers";

    const response = await fetch(url, {
      method: isEditing ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        phone: phone || null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Failed to save customer."
      );
    }

    await loadCustomers();

    setShowCustomerForm(false);
    setEditingCustomerId(null);
    setFormName("");
    setFormPhone("");

    setFormSuccess(
      isEditing
        ? "Customer details updated successfully."
        : "Customer created successfully."
    );
  } catch (error) {
    setFormError(
      error instanceof Error
        ? error.message
        : "Failed to save customer."
    );
  } finally {
    setSavingCustomer(false);
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

        if (
          employee.role !== "ADMIN" ||
          employee.status !== "ACTIVE"
        ) {
          router.replace("/dashboard");
          return;
        }

        await loadCustomers();

        setLoading(false);
      } catch (error) {
        console.error(
          "Customers page initialization failed:",
          error
        );

        router.replace("/dashboard");
      }
    };

    initialize();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8f2]">
        <p className="text-[#5b2f1f]">
          Loading customers...
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
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-[#a66a4a]">
                SWP Business Management System
              </p>

              <h1 className="mt-2 text-3xl font-bold text-[#3b2117]">
                Customers
              </h1>

              <p className="mt-2 text-[#7b5a49]">
                View customer purchases,
                payments and pending balances.
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

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Summary */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">

            <div className="rounded-2xl border border-[#f1dfd2] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#8b6b5a]">
                Customers
              </p>

              <p className="mt-2 text-2xl font-bold text-[#3b2117]">
                {customers.length}
              </p>
            </div>

            <div className="rounded-2xl border border-[#f1dfd2] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#8b6b5a]">
                Total Purchases
              </p>

              <p className="mt-2 text-2xl font-bold text-[#3b2117]">
                ₹
                {customers
                  .reduce(
                    (total, customer) =>
                      total +
                      Number(
                        customer.totalPurchases
                      ),
                    0
                  )
                  .toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
              </p>
            </div>

            <div className="rounded-2xl border border-[#f1dfd2] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#8b6b5a]">
                Total Pending
              </p>

              <p className="mt-2 text-2xl font-bold text-red-600">
                ₹
                {customers
                  .reduce(
                    (total, customer) =>
                      total +
                      Number(
                        customer.pendingBalance
                      ),
                    0
                  )
                  .toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
              </p>
            </div>
          </div>

          
{formSuccess && (
  <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
    {formSuccess}
  </div>
)}

{showCustomerForm && (
  <div className="mt-6 rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">
    <h2 className="text-lg font-semibold text-[#3b2117]">
      {editingCustomerId ? "Edit Customer" : "Add Customer"}
    </h2>

    {formError && (
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {formError}
      </div>
    )}

    <form onSubmit={handleSaveCustomer} className="mt-4 space-y-4">
      <div>
        <label htmlFor="customer-name" className="mb-1 block text-sm font-medium text-[#5b3928]">
          Customer Name *
        </label>
        <input
          id="customer-name"
          type="text"
          value={formName}
          onChange={(event) => setFormName(event.target.value)}
          maxLength={200}
          required
          className="w-full rounded-xl border border-[#e5cdbd] px-4 py-3 text-[#3b2117] outline-none focus:border-[#d96f2b]"
          placeholder="Enter customer name"
        />
      </div>

      <div>
        <label htmlFor="customer-phone" className="mb-1 block text-sm font-medium text-[#5b3928]">
          Mobile Number
        </label>
        <input
          id="customer-phone"
          type="tel"
          value={formPhone}
          onChange={(event) => setFormPhone(event.target.value)}
          maxLength={20}
          className="w-full rounded-xl border border-[#e5cdbd] px-4 py-3 text-[#3b2117] outline-none focus:border-[#d96f2b]"
          placeholder="Enter mobile number (optional)"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={savingCustomer}
          className="rounded-xl bg-[#d96f2b] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#c85f22] disabled:opacity-50"
        >
          {savingCustomer
            ? "Saving..."
            : editingCustomerId
              ? "Save Changes"
              : "Create Customer"}
        </button>

        <button
          type="button"
          disabled={savingCustomer}
          onClick={() => {
            setShowCustomerForm(false);
            setFormError("");
            setEditingCustomerId(null);
          }}
          className="rounded-xl border border-[#e5cdbd] px-5 py-2.5 text-sm font-semibold text-[#5b3928] hover:bg-[#fff8f2] disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  </div>
)}


          {/* Customer list */}
          <div className="mt-8 rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#3b2117]">
                  Customer List
                </h2>

                
<button
  type="button"
  onClick={openAddCustomerForm}
  className="mt-4 rounded-xl bg-[#d96f2b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#c85f22]"
>
  + Add Customer
</button>


                <p className="mt-1 text-sm text-[#7b5a49]">
                  Select a customer to view their
                  complete account.
                </p>
              </div>

              <span className="rounded-full bg-[#fff1e6] px-3 py-1 text-xs font-semibold text-[#a64b2b]">
                {customers.length} customers
              </span>
            </div>

            {customers.length === 0 ? (
              <div className="mt-8 rounded-xl border border-dashed border-[#e5cdbd] bg-[#fffaf6] p-10 text-center">
                <p className="font-medium text-[#5b2f1f]">
                  No customers yet.
                </p>

                <p className="mt-2 text-sm text-[#8b6b5a]">
                  Customers will appear here after
                  the first sale is created.
                </p>
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="w-[99%]">

                  <thead>
                    <tr className="border-b border-[#ead8c9] text-left text-xs uppercase tracking-wide text-[#8b6b5a]">
                      <th className="px-4 py-3">
                        Customer
                      </th>
                  

                      <th className="px-4 py-3">
                        Sales
                      </th>

                      <th className="px-4 py-3">
                        Amount
                      </th>

                      <th className="px-4 py-3">
                        Paid
                      </th>

                      <th className="px-4 py-3">
                        Pending
                      </th>

                      <th className="px-4 py-3">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {customers.map(
                      (customer) => (
                        <tr
                          key={customer.id}
                          className="border-b border-[#f3e5db] last:border-0 hover:bg-[#fffaf6]"
                        >
                          <td className="px-4 py-4">
                            <p className="font-semibold text-[#3b2117]">
                              {customer.name}
                            </p>

                            <p className="mt-1 text-xs text-[#9a7865]">
                              Customer since{" "}
                              {new Date(
                                customer.createdAt
                              ).toLocaleDateString()}
                            </p>
                          </td>

                          <td className="px-4 py-4 text-sm text-[#5b3928]">
                            {customer.salesCount}
                          </td>

                          <td className="px-4 py-4 text-sm font-semibold text-[#3b2117]">
                            ₹
                            {Number(
                              customer.totalPurchases
                            ).toLocaleString(
                              "en-IN",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </td>

                          <td className="px-4 py-4 text-sm font-semibold text-green-700">
                            ₹
                            {Number(
                              customer.totalPaid
                            ).toLocaleString(
                              "en-IN",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </td>

                          <td className="px-4 py-4">
                            {Number(
                              customer.pendingBalance
                            ) === 0 ? (
                              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                                Nil
                              </span>
                            ) : (
                              <span className="font-bold text-red-600">
                                ₹
                                {Number(
                                  customer.pendingBalance
                                ).toLocaleString(
                                  "en-IN",
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/customers/${customer.id}`
                                )
                              }
                              className="rounded-xl bg-[#d96f2b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#c85f22]"
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      )
                    )}
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