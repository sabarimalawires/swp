"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";
import Sidebar from "@/src/components/Sidebar";

type Customer = {
  id: string;
  name: string;
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

          {/* Customer list */}
          <div className="mt-8 rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#3b2117]">
                  Customer List
                </h2>

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
                <table className="w-full min-w-[750px]">

                  <thead>
                    <tr className="border-b border-[#ead8c9] text-left text-xs uppercase tracking-wide text-[#8b6b5a]">
                      <th className="px-4 py-3">
                        Customer
                      </th>

                      <th className="px-4 py-3">
                        Sales
                      </th>

                      <th className="px-4 py-3">
                        Purchases
                      </th>

                      <th className="px-4 py-3">
                        Paid
                      </th>

                      <th className="px-4 py-3">
                        Pending
                      </th>

                      <th className="px-4 py-3 text-right">
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

                          <td className="px-4 py-4 text-right">
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