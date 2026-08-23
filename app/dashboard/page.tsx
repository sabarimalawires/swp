"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/src/lib/auth-client";
import { useRouter } from "next/navigation";
import Sidebar from "@/src/components/Sidebar";

type DashboardData = {
  pendingWork: number;
  activeProducts: number;

  todaysSales: number;
  unitsSoldToday: number;
  todaysProduction: number;

  lowStockCount: number;

  lowStockProducts: {
    id: string;
    name: string;
    code: string | null;
    stock: number;
    lowStockThreshold: number;
  }[];

  monthlyBusiness: {
    production: number;
    sales: number;
    inventory: number;
  };
};

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [userName, setUserName] =
    useState("");

  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [error, setError] =
    useState("");

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

        if (cancelled) {
          return;
        }

        setUserName(data.user.name);

        const response = await fetch(
          "/api/dashboard",
          {
            method: "GET",
            headers: {
              Accept:
                "application/json",
            },
            cache: "no-store",
          }
        );

        const text =
          await response.text();

        if (!text.trim()) {
          throw new Error(
            `Dashboard API returned an empty response (HTTP ${response.status}).`
          );
        }

        let result: DashboardData & {
          error?: string;
        };

        try {
          result = JSON.parse(text);
        } catch {
          throw new Error(
            `Dashboard API returned invalid JSON (HTTP ${response.status}).`
          );
        }

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Failed to load dashboard."
          );
        }

        if (cancelled) {
          return;
        }

        setDashboard(result);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Dashboard loading failed:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load dashboard data."
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8f2]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#f1dfd2] border-t-[#d96f2b]" />

          <p className="mt-4 text-sm font-medium text-[#5b2f1f]">
            Loading dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#fff8f2]">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-[#a66a4a]">
                SWP Business Management System
              </p>

              <h1 className="mt-2 text-3xl font-bold text-[#3b2117]">
                Welcome, {userName}!
              </h1>

              <p className="mt-2 text-[#7b5a49]">
                Here's your current business overview.
              </p>
            </div>

            <div className="rounded-2xl border border-[#f1dfd2] bg-white px-6 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#a66a4a]">
                Today
              </p>

              <p className="mt-1 font-semibold text-[#3b2117]">
                Business Overview
              </p>

              <p className="mt-1 text-xs text-[#8b6b5a]">
                Live dashboard data
              </p>
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-sm font-semibold text-red-700">
                {error}
              </p>
            </div>
          )}

          {dashboard && (
            <>

              {/* MAIN KPI CARDS */}
              <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">

                <MetricCard
                  label="Pending Work"
                  value={
                    dashboard.pendingWork
                  }
                  description="Waiting for approval"
                  accent="orange"
                />

                <MetricCard
                  label="Active Products"
                  value={
                    dashboard.activeProducts
                  }
                  description="Products currently active"
                  accent="brown"
                />

                <MetricCard
                  label="Today's Sales"
                  value={
                    dashboard.todaysSales
                  }
                  description="Active sales today"
                  accent="green"
                />

                <MetricCard
                  label="Low Stock"
                  value={
                    dashboard.lowStockCount
                  }
                  description="Products needing attention"
                  accent={
                    dashboard.lowStockCount >
                    0
                      ? "red"
                      : "green"
                  }
                />

              </div>

              {/* TODAY'S ACTIVITY */}
              <section className="mt-6 rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">

                <div>
                  <h2 className="text-lg font-bold text-[#3b2117]">
                    Today's Activity
                  </h2>

                  <p className="mt-1 text-sm text-[#7b5a49]">
                    Production and sales recorded today.
                  </p>
                </div>

                <div className="mt-6 grid gap-5 md:grid-cols-2">

                  <ActivityCard
                    title="Units Sold Today"
                    value={
                      dashboard.unitsSoldToday
                    }
                    description="Total units from active sales"
                  />

                  <ActivityCard
                    title="Today's Production"
                    value={
                      dashboard.todaysProduction
                    }
                    description="Units added from approved work"
                  />

                </div>
              </section>

              {/* MONTHLY BUSINESS OVERVIEW */}
              <section className="mt-6 rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                  <div>
                    <h2 className="text-lg font-bold text-[#3b2117]">
                      Monthly Business Overview
                    </h2>

                    <p className="mt-1 text-sm text-[#7b5a49]">
                      Production, sales and inventory for the current month.
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-[#fff1e6] px-3 py-1 text-xs font-semibold text-[#a66a4a]">
                    Current Month
                  </span>

                </div>

                <div className="mt-6 grid gap-5 md:grid-cols-3">

                  <MonthlyBusinessCard
                    label="Production"
                    value={
                      dashboard
                        .monthlyBusiness
                        .production
                    }
                    description="Units produced"
                    color="brown"
                  />

                  <MonthlyBusinessCard
                    label="Sales"
                    value={
                      dashboard
                        .monthlyBusiness
                        .sales
                    }
                    description="Units sold"
                    color="green"
                  />

                  <MonthlyBusinessCard
                    label="Inventory"
                    value={
                      dashboard
                        .monthlyBusiness
                        .inventory
                    }
                    description="Units currently available"
                    color="orange"
                  />

                </div>
              </section>

              {/* LOW STOCK */}
              <section className="mt-6 rounded-2xl border border-[#f1dfd2] bg-white shadow-sm">

                <div className="flex flex-col gap-4 border-b border-[#f1dfd2] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

                  <div>
                    <h2 className="text-lg font-bold text-[#3b2117]">
                      Low Stock Products
                    </h2>

                    <p className="mt-1 text-sm text-[#7b5a49]">
                      Products currently below their stock threshold.
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                      dashboard.lowStockCount >
                      0
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {
                      dashboard.lowStockCount
                    }{" "}
                    {
                      dashboard.lowStockCount ===
                      1
                        ? "product"
                        : "products"
                    }
                  </span>

                </div>

                {dashboard
                  .lowStockProducts
                  .length === 0 ? (
                  <div className="px-6 py-10 text-center">

                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
                      ✓
                    </div>

                    <p className="mt-4 font-semibold text-[#3b2117]">
                      Stock levels look good
                    </p>

                    <p className="mt-1 text-sm text-[#7b5a49]">
                      No active products are currently below their threshold.
                    </p>

                  </div>
                ) : (
                  <div className="overflow-x-auto">

                    <table className="w-full min-w-[650px]">

                      <thead>
                        <tr className="border-b border-[#f1dfd2] bg-[#fffaf6] text-left">

                          <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                            Product
                          </th>

                          <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                            Code
                          </th>

                          <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                            Current Stock
                          </th>

                          <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                            Threshold
                          </th>

                          <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                            Status
                          </th>

                        </tr>
                      </thead>

                      <tbody>

                        {dashboard
                          .lowStockProducts
                          .map(
                            (product) => (
                              <tr
                                key={
                                  product.id
                                }
                                className="border-b border-[#f4e8df] last:border-b-0"
                              >

                                <td className="px-6 py-4">
                                  <p className="text-sm font-semibold text-[#3b2117]">
                                    {
                                      product.name
                                    }
                                  </p>
                                </td>

                                <td className="px-6 py-4 text-sm text-[#7b5a49]">
                                  {product.code ||
                                    "—"}
                                </td>

                                <td className="px-6 py-4">
                                  <span className="text-sm font-bold text-red-700">
                                    {
                                      product.stock
                                    }
                                  </span>
                                </td>

                                <td className="px-6 py-4 text-sm text-[#5b3928]">
                                  {
                                    product.lowStockThreshold
                                  }
                                </td>

                                <td className="px-6 py-4">
                                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                                    Low Stock
                                  </span>
                                </td>

                              </tr>
                            )
                          )}

                      </tbody>
                    </table>

                  </div>
                )}

              </section>

            </>
          )}
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  description,
  accent,
}: {
  label: string;
  value: number;
  description: string;
  accent:
    | "orange"
    | "brown"
    | "green"
    | "red";
}) {
  const colors = {
    orange: {
      background: "bg-[#fff1e6]",
      text: "text-[#d96f2b]",
      dot: "bg-[#d96f2b]",
    },

    brown: {
      background: "bg-[#f7eee8]",
      text: "text-[#7a4b35]",
      dot: "bg-[#7a4b35]",
    },

    green: {
      background: "bg-green-50",
      text: "text-green-700",
      dot: "bg-green-600",
    },

    red: {
      background: "bg-red-50",
      text: "text-red-700",
      dot: "bg-red-600",
    },
  };

  const color = colors[accent];

  return (
    <div className="rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">

      <div className="flex items-center justify-between">

        <p className="text-sm font-medium text-[#7b5a49]">
          {label}
        </p>

        <span
          className={`h-2.5 w-2.5 rounded-full ${color.dot}`}
        />

      </div>

      <p className="mt-3 text-3xl font-bold text-[#3b2117]">
        {value.toLocaleString()}
      </p>

      <div
        className={`mt-4 inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold ${color.background} ${color.text}`}
      >
        {description}
      </div>

    </div>
  );
}

function ActivityCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[#f1dfd2] bg-[#fffaf6] p-5">

      <p className="text-sm font-semibold text-[#a66a4a]">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-[#3b2117]">
        {value.toLocaleString()}
      </p>

      <p className="mt-2 text-sm text-[#7b5a49]">
        {description}
      </p>

    </div>
  );
}

function MonthlyBusinessCard({
  label,
  value,
  description,
  color,
}: {
  label: string;
  value: number;
  description: string;
  color:
    | "brown"
    | "green"
    | "orange";
}) {
  const colors = {
    brown: {
      background: "bg-[#f7eee8]",
      text: "text-[#7a4b35]",
    },

    green: {
      background: "bg-green-50",
      text: "text-green-700",
    },

    orange: {
      background: "bg-[#fff1e6]",
      text: "text-[#d96f2b]",
    },
  };

  const selectedColor =
    colors[color];

  return (
    <div
      className={`rounded-xl border border-[#f1dfd2] p-6 ${selectedColor.background}`}
    >

      <p className="text-sm font-semibold uppercase tracking-wide text-[#8b6b5a]">
        {label}
      </p>

      <p
        className={`mt-3 text-3xl font-bold ${selectedColor.text}`}
      >
        {value.toLocaleString()}
      </p>

      <p className="mt-2 text-sm text-[#7b5a49]">
        {description}
      </p>

    </div>
  );
}