"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/src/lib/auth-client";
import { useRouter } from "next/navigation";
import Sidebar from "@/src/components/Sidebar";
import Link from "next/link";

type Period = "daily" | "monthly" | "yearly";

type DashboardData = {
  salesAmountToday: number;
  todaysSales: number;
  salesQuantityToday: number;
  todaysProduction: number;
  monthlySalesKpi: { amount: number; count: number; weight: number };
  monthlyPurchaseKpi: { amount: number; count: number; weight: number };

  monthlyBusiness: {
    salesCount: number;
    salesAmount: number;
    salesQuantity: number;
    production: number;
    selectedMonth: number;
    selectedYear: number;
  };

  ledgerSummary: {
    openingBalance: number;
    totalSales: number;
    closingBalance: number;
  };

  pendingWork: number;
  activeProducts: number;
  lowStockCount: number;
  totalInventory: number;

  lowStockProducts: {
    id: string;
    name: string;
    code: string | null;
    stock: number;
    lowStockThreshold: number;
  }[];

  salesTrend: {
    label: string;
    amount: number;
  }[];

  chartPeriod: Period;
  selectedFY: number;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const number = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);

const currentYear = new Date().getFullYear();
const currentFY =
  new Date().getMonth() < 3 ? currentYear - 1 : currentYear;

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [salesMonth, setSalesMonth] = useState(new Date().getMonth() + 1);
  const [salesYear, setSalesYear] = useState(currentYear);
  const [purchaseMonth, setPurchaseMonth] = useState(new Date().getMonth() + 1);
  const [purchaseYear, setPurchaseYear] = useState(currentYear);
  const [selectedFY, setSelectedFY] = useState(currentFY);
  const [period, setPeriod] = useState<Period>("monthly");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/dashboard?month=${selectedMonth}&year=${selectedYear}&salesMonth=${salesMonth}&salesYear=${salesYear}&purchaseMonth=${purchaseMonth}&purchaseYear=${purchaseYear}&period=${period}&fy=${selectedFY}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load dashboard.");
      }

      setDashboard(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }, [
    selectedMonth,
    selectedYear,
    salesMonth,
    salesYear,
    purchaseMonth,
    purchaseYear,
    selectedFY,
    period,
  ]);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        const { data } = await authClient.getSession();

        if (!data?.user) {
          router.replace("/");
          return;
        }

        if (!cancelled) {
          setUserName(data.user.name ?? "Admin");
          await loadDashboard();
        }
      } catch {
        if (!cancelled) {
          router.replace("/");
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, [router, loadDashboard]);

  if (loading && !dashboard) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F8F5]">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#DED2B8] border-t-[#073D2D]" />
          <p className="mt-4 text-sm font-medium text-[#66513E]">
            Loading dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F4F8F5] text-[#123D2E]">
      <Sidebar />

      <main className="swp-page-main min-w-0 flex-1 p-3 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1500px]">

          {/* HEADER */}
          <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-[#80664F]">
                SWP Business Management System
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#073D2D] sm:text-3xl">
                Welcome, {userName}!
              </h1>
              <p className="mt-1 text-sm text-[#80664F]">
                Here's your business at a glance.
              </p>
            </div>
          </header>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
              <button
                onClick={loadDashboard}
                className="ml-3 font-bold underline"
              >
                Retry
              </button>
            </div>
          )}

          {dashboard && (
            <>
              {/* TOP KPI CARDS */}
              <section className="mt-6 grid grid-cols-2 gap-4 sm:mt-4 sm:gap-4">
                <div className="col-span-2">
  <Link href="/sales#history" className="col-span-2 block cursor-pointer">
  <KpiCard
    title="Daily Sales"
    value={money(dashboard.salesAmountToday)}
    subtitle={`${number(dashboard.todaysSales)} Sales | ${number(dashboard.salesQuantityToday)} kg`}
    icon={<SalesIcon />}
  />
</Link>
</div>

                <MonthlyKpiCard
                  title="Monthly Sales"
                  value={money(dashboard.monthlySalesKpi.amount)}
                  detail={`${number(dashboard.monthlySalesKpi.count)} Sales  |  ${number(dashboard.monthlySalesKpi.weight)} kg`}
                  icon={<ChartIcon />}
                  month={salesMonth}
                  year={salesYear}
                  onMonthChange={setSalesMonth}
                  onYearChange={setSalesYear}
                />

                <MonthlyKpiCard
                  title="Monthly Purchase"
                  value={money(dashboard.monthlyPurchaseKpi.amount)}
                  detail={`${number(dashboard.monthlyPurchaseKpi.count)} Purchases  |  ${number(dashboard.monthlyPurchaseKpi.weight)} kg`}
                  icon={<PurchaseIcon />}
                  month={purchaseMonth}
                  year={purchaseYear}
                  onMonthChange={setPurchaseMonth}
                  onYearChange={setPurchaseYear}
                />
              </section>

              {/* SALES GRAPH */}
              <section className="mt-3 overflow-hidden rounded-2xl border border-[#D8E5D9] bg-gradient-to-br from-white via-[#F8FCF8] to-[#EDF5EE] shadow-[0_3px_12px_rgba(15,65,42,0.06)]">
                <div className="flex flex-col gap-3 border-b border-[#D8E5D9] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
                  <div>
                    <h2 className="text-lg font-bold text-[#073D2D]">
                      Sales Amount Trend
                    </h2>
                    <p className="mt-1 text-sm text-[#718477]">
                      Track your sales performance over time.
                    </p>
                  </div>
               <select
                    value={selectedFY}
                    onChange={(e) => setSelectedFY(Number(e.target.value))}
                    className="h-10 w-full rounded-xl border border-[#D5E4D7] bg-white px-3 text-sm font-semibold text-[#174B32] outline-none transition focus:border-[#176B45] focus:ring-2 focus:ring-[#176B45]/10 sm:w-auto"
                  >
                    {Array.from({ length: 7 }, (_, i) => currentFY - i).map(
                      (year) => (
                        <option key={year} value={year}>
                          FY {year}-{String(year + 1).slice(-2)}
                        </option>
                      )
                    )}
                  </select>
                  <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
                    {(["daily", "monthly", "yearly"] as Period[]).map(
                      (item) => (
                        <button
                          key={item}
                          onClick={() => setPeriod(item)}
                          className={`rounded-lg px-2 py-2.5 text-xs font-bold capitalize transition sm:px-4 sm:py-2 ${
                            period === item
                              ? "bg-[#073D2D] text-white shadow-sm"
                              : "bg-[#F1F6F2] text-[#60796A] hover:bg-[#E8F2EB]"
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div className="w-full overflow-x-auto px-3 pb-5 pt-3 sm:px-6 sm:pb-7">
                  <div className="min-w-[620px] sm:min-w-0">
                    <SalesChart data={dashboard.salesTrend} />
                  </div>
                </div>
              </section>

              {/* LEDGER SUMMARY */}
              <section className="mt-6 rounded-2xl border border-[#D8E5D9] bg-gradient-to-br from-white via-[#F8FCF8] to-[#EDF5EE] p-4 shadow-[0_3px_12px_rgba(15,65,42,0.06)] sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#073D2D]">
                      Overall Ledger Summary
                    </h2>
                    <p className="mt-1 text-sm text-[#92765E]">
                      Combined customer ledger position.
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-[#E3E9D8] px-3 py-1.5 text-xs font-bold text-[#073D2D]">
                    FY {selectedFY}-{String(selectedFY + 1).slice(-2)}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-3 sm:gap-4">
                  <LedgerMetric
                    title="Opening Balance"
                    value={dashboard.ledgerSummary.openingBalance}
                    color="neutral"
                  />
                  <LedgerMetric
                    title="Total Sales"
                    value={dashboard.ledgerSummary.totalSales}
                    color="neutral"
                  />
                  <LedgerMetric
                    title="Closing Balance"
                    value={dashboard.ledgerSummary.closingBalance}
                    color="neutral"
                  />
                </div>
              </section>

              {/* LOW STOCK PRODUCTS */}
              <section className="mt-6 overflow-hidden rounded-2xl border border-[#D8E5D9] bg-gradient-to-br from-white via-[#F8FCF8] to-[#EDF5EE] shadow-[0_3px_12px_rgba(15,65,42,0.06)]">
                <div className="flex flex-col gap-3 border-b border-[#D8E5D9] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div>
                    <h2 className="text-lg font-bold text-[#073D2D]">
                      Low Stock Products
                    </h2>
                    <p className="mt-1 text-sm text-[#92765E]">
                      Products that need stock replenishment.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      dashboard.lowStockCount > 0
                        ? "bg-red-50 text-red-600"
                        : "bg-[#E3E9D8] text-[#073D2D]"
                    }`}>
                      {dashboard.lowStockCount} products
                    </span>

                    <button
                      onClick={() => router.push("/inventory")}
                      className="rounded-lg border border-[#DED2B8] px-3 py-2 text-xs font-bold text-[#073D2D] transition hover:bg-[#F1F7F2]"
                    >
                      View Inventory →
                    </button>
                  </div>
                </div>

                {dashboard.lowStockProducts.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E3E9D8] text-xl font-bold text-[#073D2D]">
                      ✓
                    </div>
                    <p className="mt-4 font-bold text-[#073D2D]">
                      All stock levels look good!
                    </p>
                    <p className="mt-1 text-sm text-[#92765E]">
                      No active products are currently at or below their
                      configured threshold.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px]">
                      <thead>
                        <tr className="bg-[#E8F2EB] text-left">
                          {["Product", "Code", "Current Stock", "Threshold", "Status"].map(
                            (heading) => (
                              <th
                                key={heading}
                                className="px-6 py-4 text-xs font-bold uppercase tracking-wide text-[#92765E]"
                              >
                                {heading}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.lowStockProducts.map((product) => (
                          <tr
                            key={product.id}
                            className="border-t border-[#E3ECE4] transition hover:bg-white/70"
                          >
                            <td className="px-6 py-4 text-sm font-bold text-[#244C35]">
                              {product.name}
                            </td>
                            <td className="px-6 py-4 text-sm text-[#92765E]">
                              {product.code || "—"}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-red-600">
                              {number(product.stock)} kg
                            </td>
                            <td className="px-6 py-4 text-sm text-[#66513E]">
                              {number(product.lowStockThreshold)} kg
                            </td>
                            <td className="px-6 py-4">
                              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                                Low Stock
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* FOOTER */}
              <footer className="py-8 text-center text-xs text-[#92765E]">
                Sabarimala Wire Products · Business Management System
              </footer>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function KpiCard({
  title, value, subtitle, icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#D8E5D9] bg-gradient-to-br from-white via-[#F8FCF8] to-[#EDF5EE] p-3 shadow-[0_3px_12px_rgba(15,65,42,0.06)] transition-all duration-200 hover:-translate-y-1 hover:border-[#A9CBB1] hover:shadow-[0_8px_22px_rgba(15,65,42,0.10)] sm:p-4">
      <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-[#E5F1E6]/70" />

      <div className="relative flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[#174B32]">{title}</p>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E5F1E8] text-[#176B45] shadow-sm">
          {icon}
        </div>
      </div>

      <div className="relative mt-4">
        <p className="break-words text-2xl font-extrabold tracking-tight text-[#125536] sm:text-3xl">
          {value}
        </p>

        <p className="mt-2 text-xs font-medium text-[#718477] sm:text-sm">
          {subtitle}
        </p>
      </div>

      <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-[#176B45] via-[#6EAD79] to-transparent opacity-70" />
    </div>
  );
}

function MonthlyKpiCard({
  title,
  value,
  detail,
  icon,
  month,
  year,
  onMonthChange,
  onYearChange,
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  month: number;
  year: number;
  onMonthChange: (value: number) => void;
  onYearChange: (value: number) => void;
}) {
  const monthInputRef = useRef<HTMLInputElement>(null);
  const monthValue = `${year}-${String(month).padStart(2, "0")}`;

  const openMonthPicker = () => {
    const input = monthInputRef.current;
    if (!input) return;

    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.focus();
        input.click();
      }
    } catch {
      input.focus();
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#D8E5D9] bg-gradient-to-br from-white via-[#F8FCF8] to-[#EDF5EE] p-3 shadow-[0_3px_12px_rgba(15,65,42,0.06)] transition-all duration-200 hover:-translate-y-1 hover:border-[#A9CBB1] hover:shadow-[0_8px_22px_rgba(15,65,42,0.10)] sm:p-4">
      <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-[#E5F1E6]/70" />

      <div className="relative flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E5F1E8] text-[#176B45] shadow-sm">
            {icon}
          </div>

          <p className="text-sm font-bold text-[#174B32] sm:text-base">
            {title}
          </p>
        </div>

        <button
          type="button"
          onClick={openMonthPicker}
          className="relative z-10 inline-flex w-full max-w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#D5E4D7] bg-white px-3 py-2.5 text-xs font-semibold text-[#245C3B] shadow-sm transition hover:border-[#176B45] hover:bg-[#F5FAF5] sm:w-auto sm:justify-start"
          aria-label={`Choose ${title} month`}
        >
          <span>
            {new Date(year, month - 1).toLocaleString("en-IN", {
              month: "long",
              year: "numeric",
            })}
          </span>
          <CalendarIcon />
        </button>

        <input
          ref={monthInputRef}
          type="month"
          value={monthValue}
          onChange={(event) => {
            if (!event.target.value) return;

            const [newYear, newMonth] = event.target.value
              .split("-")
              .map(Number);

            onMonthChange(newMonth);
            onYearChange(newYear);
          }}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      <div className="relative mt-2 sm:mt-3">
        <p className="break-words text-2xl font-extrabold tracking-tight text-[#125536] sm:text-2xl">
          {value}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-3">
          <span className="h-1.5 w-1.5 rounded-full bg-[#26965C]" />
          <p className="break-words text-xs font-medium text-[#718477] sm:text-sm">{detail}</p>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-[#176B45] via-[#6EAD79] to-transparent opacity-70" />
    </div>
  );
}



function BusinessMetric({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-[#D8E5D9] bg-gradient-to-br from-white to-[#EAF4EC] p-4 shadow-sm sm:p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-[#92765E]">
        {title}
      </p>
      <p className="mt-3 break-words text-xl font-extrabold text-[#073D2D]">
        {value}
      </p>
      <p className="mt-2 text-xs text-[#92765E]">{detail}</p>
    </div>
  );
}

function LedgerMetric({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: "neutral" | "blue" | "green";
}) {
  const styles = {
    neutral: "bg-gradient-to-br from-white to-[#EDF5EE] border-[#D8E5D9]",
    blue: "bg-gradient-to-br from-white to-[#EDF5EE] border-[#D8E5D9]",
    green: "bg-gradient-to-br from-white to-[#E5F2E7] border-[#CFE3D2]",
  };

  return (
    <div className={`rounded-xl border p-5 ${styles[color]}`}>
      <p className="text-sm font-semibold text-[#80664F]">{title}</p>
      <p className="mt-3 break-words text-2xl font-extrabold text-[#073D2D]">
        {money(value)}
      </p>
    </div>
  );
}


function SalesChart({
  data,
}: {
  data: { label: string; amount: number }[];
}) {
  const [activePoint, setActivePoint] = useState<number | null>(null);

  const width = 900;
  const height = 220;
  const left = 65;
  const right = 25;
  const top = 65;
  const bottom = 45;

  const max = Math.max(...data.map((item) => item.amount), 1);
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const baseline = top + chartHeight;

  const points = data.map((item, index) => ({
    x:
      left +
      (data.length <= 1
        ? chartWidth / 2
        : (index / (data.length - 1)) * chartWidth),
    y: top + chartHeight - (item.amount / max) * chartHeight,
    ...item,
  }));

  const line = points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");

  const area = `${line} L ${points[points.length - 1]?.x ?? left} ${
    baseline
  } L ${left} ${baseline} Z`;

  const formatAxis = (value: number) =>
    value >= 100000
      ? `₹${(value / 100000).toFixed(1)}L`
      : value >= 1000
        ? `₹${(value / 1000).toFixed(0)}k`
        : `₹${Math.round(value)}`;

  const formatTooltipAmount = (value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-[#92765E]">
        No sales data available for this period.
      </div>
    );
  }

  const selected =
    activePoint !== null ? points[activePoint] : null;

  const tooltipX = selected
    ? Math.max(90, Math.min(width - 90, selected.x))
    : 0;

  const tooltipY = selected
    ? selected.y - 65
    : 0;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[180px] w-full min-w-[620px] overflow-visible sm:h-auto sm:min-w-0"
        role="img"
        aria-label="Sales amount trend chart"
      >
        <defs>
          <linearGradient
            id="salesAreaGradient"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#176B45" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#176B45" stopOpacity="0.01" />
          </linearGradient>
          <filter id="tooltipShadow" x="-30%" y="-30%" width="160%" height="180%">
  <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.25" />
</filter>
        </defs>

        {[0, 1, 2, 3].map((step) => {
          const y = top + (chartHeight / 3) * step;
          const value = max * (1 - step / 3);

          return (
            <g key={step}>
              <line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke="#E9F0EA"
                strokeDasharray="4 5"
              />
              <text
                x={left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="#92765E"
              >
                {formatAxis(value)}
              </text>
            </g>
          );
        })}

        <path d={area} fill="url(#salesAreaGradient)" />

        <path
          d={line}
          fill="none"
          stroke="#176B45"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Selected point vertical guide line */}
        {selected && (
          <line
            x1={selected.x}
            x2={selected.x}
            y1={selected.y + 8}
            y2={baseline}
            stroke="#176B45"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.65"
          />
        )}

        {points.map((point, index) => (
          <g
            key={`${point.label}-${index}`}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") {
                setActivePoint(index);
              }
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") {
                setActivePoint(null);
              }
            }}
            onPointerDown={() => setActivePoint(index)}
            className="cursor-pointer"
          >
            {/* Larger invisible touch target */}
            <circle
              cx={point.x}
              cy={point.y}
              r="14"
              fill="transparent"
            />

            {/* Highlight selected point */}
            {activePoint === index && (
              <circle
                cx={point.x}
                cy={point.y}
                r="9"
                fill="#176B45"
                fillOpacity="0.15"
              />
            )}

            <circle
              cx={point.x}
              cy={point.y}
              r={activePoint === index ? 6 : 5}
              fill="#FFFFFF"
              stroke="#176B45"
              strokeWidth={activePoint === index ? 3 : 2.5}
            >
              <title>
                {`${point.label}: ${formatTooltipAmount(point.amount)}`}
              </title>
            </circle>

            {(data.length <= 12 ||
              index % Math.ceil(data.length / 8) === 0 ||
              index === data.length - 1) && (
              <text
                x={point.x}
                y={height - 12}
                textAnchor="middle"
                fontSize="11"
                fill="#92765E"
              >
                {point.label}
              </text>
            )}
          </g>
        ))}

        {/* Custom tooltip */}
        {selected && (
          <g pointerEvents="none">
            <path
              d={`M ${tooltipX - 8} ${tooltipY + 54}
                  L ${tooltipX + 8} ${tooltipY + 54}
                  L ${selected.x} ${selected.y - 5} Z`}
              fill="#164D2B"
            />

            <rect
              x={tooltipX - 90}
              y={tooltipY}
              width="180"
              height="54"
              rx="10"
              fill="#164D2B"
              stroke="#0D3D20"
              strokeWidth="1"
              filter="url(#tooltipShadow)"
            />

            <text
              x={tooltipX}
              y={tooltipY + 19}
              textAnchor="middle"
              fontSize="12"
              fill="#FFFFFF"
            >
              {selected.label}
            </text>

            <text
              x={tooltipX}
              y={tooltipY + 39}
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fill="#FFFFFF"
            >
              {formatTooltipAmount(selected.amount)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}


function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function SalesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3v18h18M7 14l4-4 4 3 6-7" />
      <path d="M16 6h5v5" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7 15l3-3 3 2 4-5M7 18h10" />
    </svg>
  );
}

function PurchaseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </svg>
  );
}

function LedgerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h3" />
    </svg>
  );
}