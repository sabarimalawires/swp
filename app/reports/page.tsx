"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/src/components/Sidebar";
import DownloadOverallReportPdf from "@/src/components/reports/DownloadOverallReportPdf";

type ProductOption = {
  id: string;
  name: string;
  code: string | null;
};

type WorkerOption = {
  id: string;
  name: string;
  username: string;
};

type ReportData = {
  report: {
    type: string;
    generatedAt: string;

    generatedBy: {
      id: string;
      name: string;
      username: string;
    };

    filters: {
      from: string | null;
      to: string | null;
      product: ProductOption | null;
      worker: WorkerOption | null;
    };

    summary: {
      totalWorkEntries: number;
      approvedWorkEntries: number;
      rejectedWorkEntries: number;
      pendingWorkEntries: number;
      totalProduction: number;
      totalSalesQuantity: number;
      totalActiveSales: number;
      totalVoidedSales: number;
      lowStockProductCount: number;
    };

    inventory: {
      products: {
        id: string;
        name: string;
        code: string | null;
        stock: number;
        lowStockThreshold: number;
        isLowStock: boolean;
      }[];

      lowStockProducts: {
        id: string;
        name: string;
        code: string | null;
        stock: number;
        lowStockThreshold: number;
        isLowStock: boolean;
      }[];
    };

    workEntries: {
      id: string;
      quantity: number;
      status: string;
      submittedAt: string;

      worker: {
        name: string;
        username: string;
      };

      product: {
        name: string;
        code: string | null;
      };
    }[];

    sales: {
      id: string;
      customerName: string;
      quantity: number;
      saleDate: string;
      status: string;

      product: {
        name: string;
        code: string | null;
      };
    }[];
  };
};

function formatDate(value: string | null) {
  if (!value) {
    return "All dates";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function readJsonResponse(
  response: Response,
  label: string
) {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error(
      `${label} returned an empty response (HTTP ${response.status}).`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    console.error(`${label} returned invalid JSON:`, text);

    throw new Error(
      `${label} returned an invalid response (HTTP ${response.status}).`
    );
  }
}

export default function ReportsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [productId, setProductId] = useState("");
  const [workerId, setWorkerId] = useState("");

  const [report, setReport] = useState<ReportData | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      setLoadingOptions(true);
      setError("");

      try {
        const productsResponse = await fetch("/api/products", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (productsResponse.status === 401) {
          router.replace("/");
          return;
        }

        if (productsResponse.status === 403) {
          router.replace("/dashboard");
          return;
        }

        const productsResult = await readJsonResponse(
          productsResponse,
          "Products API"
        );

        if (!productsResponse.ok) {
          throw new Error(
            productsResult?.error ||
              `Failed to load products (HTTP ${productsResponse.status}).`
          );
        }

        if (!Array.isArray(productsResult)) {
          throw new Error(
            "Products API returned an unexpected response."
          );
        }

        const employeesResponse = await fetch("/api/employees", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (employeesResponse.status === 401) {
          router.replace("/");
          return;
        }

        if (employeesResponse.status === 403) {
          router.replace("/dashboard");
          return;
        }

        const employeesResult = await readJsonResponse(
          employeesResponse,
          "Employees API"
        );

        if (!employeesResponse.ok) {
          throw new Error(
            employeesResult?.error ||
              `Failed to load employees (HTTP ${employeesResponse.status}).`
          );
        }

        if (!Array.isArray(employeesResult)) {
          throw new Error(
            "Employees API returned an unexpected response."
          );
        }

        if (cancelled) {
          return;
        }

        setProducts(productsResult);

        const workerEmployees = employeesResult.filter(
          (employee: {
            id: string;
            name: string;
            username: string;
            role: string;
            status: string;
          }) =>
            employee.role === "WORKER" &&
            employee.status === "ACTIVE"
        );

        setWorkers(workerEmployees);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Report filter loading failed:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load report filters."
        );
      } finally {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      }
    };

    loadOptions();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleGenerateReport = async () => {
    setError("");
    setReport(null);

    if (from && to && from > to) {
      setError(
        "Start date cannot be later than end date."
      );
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (from) {
        params.set("from", from);
      }

      if (to) {
        params.set("to", to);
      }

      if (productId) {
        params.set("productId", productId);
      }

      if (workerId) {
        params.set("workerId", workerId);
      }

      const response = await fetch(
        `/api/reports?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        router.replace("/");
        return;
      }

      if (response.status === 403) {
        router.replace("/dashboard");
        return;
      }

      const result = await readJsonResponse(
        response,
        "Reports API"
      );

      if (!response.ok) {
        throw new Error(
          result?.error ||
            `Failed to generate report (HTTP ${response.status}).`
        );
      }

      if (!result?.report) {
        throw new Error(
          "Reports API returned an invalid report."
        );
      }

      setReport(result);
    } catch (error) {
      console.error(
        "Report generation failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while generating the report."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFrom("");
    setTo("");
    setProductId("");
    setWorkerId("");
    setReport(null);
    setError("");
  };

  return (
    <div className="flex min-h-screen bg-[#fff8f2]">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">

          {/* PAGE HEADER */}
          <div>
            <p className="text-sm text-[#a66a4a]">
              SWP Business Management System
            </p>

            <h1 className="mt-2 text-3xl font-bold text-[#3b2117]">
              Reports
            </h1>

            <p className="mt-2 text-[#7b5a49]">
              Generate the overall business report.
            </p>
          </div>

          {/* FILTERS */}
          <section className="mt-8 rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">

            <div className="mb-5">
              <h2 className="text-lg font-semibold text-[#3b2117]">
                Report Filters
              </h2>

              <p className="mt-1 text-sm text-[#7b5a49]">
                Choose the data to include in the report.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-5">

              {/* FROM */}
              <div>
                <label
                  htmlFor="report-from"
                  className="mb-2 block text-sm font-semibold text-[#5b3928]"
                >
                  From Date
                </label>

                <input
                  id="report-from"
                  type="date"
                  value={from}
                  onChange={(event) =>
                    setFrom(event.target.value)
                  }
                  className="h-11 rounded-xl border border-[#e8d4c5] bg-white px-3 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                />
              </div>

              {/* TO */}
              <div>
                <label
                  htmlFor="report-to"
                  className="mb-2 block text-sm font-semibold text-[#5b3928]"
                >
                  To Date
                </label>

                <input
                  id="report-to"
                  type="date"
                  value={to}
                  onChange={(event) =>
                    setTo(event.target.value)
                  }
                  className="h-11 rounded-xl border border-[#e8d4c5] bg-white px-3 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                />
              </div>

              {/* PRODUCT */}
              <div>
                <label
                  htmlFor="report-product"
                  className="mb-2 block text-sm font-semibold text-[#5b3928]"
                >
                  Product
                </label>

                <select
                  id="report-product"
                  value={productId}
                  onChange={(event) =>
                    setProductId(event.target.value)
                  }
                  disabled={loadingOptions}
                  className="h-11 min-w-[220px] rounded-xl border border-[#e8d4c5] bg-white px-3 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0] disabled:bg-[#fffaf6]"
                >
                  <option value="">
                    All Products
                  </option>

                  {products.map((product) => (
                    <option
                      key={product.id}
                      value={product.id}
                    >
                      {product.name}
                      {product.code
                        ? ` (${product.code})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* WORKER */}
              <div>
                <label
                  htmlFor="report-worker"
                  className="mb-2 block text-sm font-semibold text-[#5b3928]"
                >
                  Worker
                </label>

                <select
                  id="report-worker"
                  value={workerId}
                  onChange={(event) =>
                    setWorkerId(event.target.value)
                  }
                  disabled={loadingOptions}
                  className="h-11 min-w-[220px] rounded-xl border border-[#e8d4c5] bg-white px-3 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0] disabled:bg-[#fffaf6]"
                >
                  <option value="">
                    All Workers
                  </option>

                  {workers.map((worker) => (
                    <option
                      key={worker.id}
                      value={worker.id}
                    >
                      {worker.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* GENERATE */}
              <button
                type="button"
                onClick={handleGenerateReport}
                disabled={loading || loadingOptions}
                className="h-11 rounded-xl bg-[#d96f2b] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c85f22] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Generating..."
                  : loadingOptions
                    ? "Loading..."
                    : "Generate Report"}
              </button>

              {/* CLEAR */}
              <button
                type="button"
                onClick={handleClear}
                disabled={loading}
                className="h-11 rounded-xl border border-[#e8d4c5] bg-white px-5 text-sm font-semibold text-[#5b3928] transition hover:bg-[#fff1e6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Clear
              </button>
            </div>
          </section>

          {/* ERROR */}
          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-700">
                {error}
              </p>
            </div>
          )}

          {/* EMPTY STATE */}
          {!report && !loading && !error && (
            <div className="mt-8 rounded-2xl border border-dashed border-[#e5cdbd] bg-white p-12 text-center shadow-sm">
              <p className="font-semibold text-[#5b2f1f]">
                No report generated yet.
              </p>

              <p className="mt-2 text-sm text-[#8b6b5a]">
                Select your filters and click Generate Report.
              </p>
            </div>
          )}

          {/* REPORT */}
          {report && (
            <div className="mt-8 space-y-8">

              {/* REPORT HEADER */}
              <section className="rounded-2xl border border-[#f1dfd2] bg-white p-8 shadow-sm">

                <div className="border-b border-[#f1dfd2] pb-6 text-center">
                  <p className="text-sm font-semibold tracking-wide text-[#a66a4a]">
                    SWP
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-[#3b2117]">
                    BUSINESS MANAGEMENT SYSTEM
                  </h2>

                  <h3 className="mt-4 text-xl font-bold text-[#d96f2b]">
                    OVERALL BUSINESS REPORT
                  </h3>
                </div>

                <div className="mt-6 grid gap-6 sm:grid-cols-2">

                  <ReportInfo
                    label="Generated Date"
                    value={new Date(
                      report.report.generatedAt
                    ).toLocaleDateString()}
                  />

                  <ReportInfo
                    label="Generated Time"
                    value={new Date(
                      report.report.generatedAt
                    ).toLocaleTimeString()}
                  />

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#a66a4a]">
                      Generated By
                    </p>

                    <p className="mt-1 text-sm font-semibold text-[#3b2117]">
                      {report.report.generatedBy.name}
                    </p>

                    <p className="text-xs text-[#8b6b5a]">
                      {report.report.generatedBy.username}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#a66a4a]">
                      Report Filters
                    </p>

                    <p className="mt-1 text-sm font-semibold text-[#3b2117]">
                      Date:{" "}
                      {formatDate(
                        report.report.filters.from
                      )}{" "}
                      →{" "}
                      {formatDate(
                        report.report.filters.to
                      )}
                    </p>

                    <p className="mt-1 text-sm text-[#5b3928]">
                      Product:{" "}
                      {report.report.filters.product?.name ||
                        "All Products"}
                    </p>

                    <p className="mt-1 text-sm text-[#5b3928]">
                      Worker:{" "}
                      {report.report.filters.worker?.name ||
                        "All Workers"}
                    </p>
                  </div>
                </div>

                {/* PDF BUTTON */}
                <div className="mt-6 flex justify-end border-t border-[#f1dfd2] pt-6">
                  <DownloadOverallReportPdf data={report} />
                </div>
              </section>

              {/* SUMMARY */}
              <section className="rounded-2xl border border-[#f1dfd2] bg-white p-8 shadow-sm">

                <div className="mb-6">
                  <h2 className="text-lg font-bold text-[#3b2117]">
                    Summary
                  </h2>

                  <p className="mt-1 text-sm text-[#7b5a49]">
                    Key business activity for the selected filters.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                  <SummaryCard
                    label="Total Work Entries"
                    value={
                      report.report.summary.totalWorkEntries
                    }
                  />

                  <SummaryCard
                    label="Approved Work"
                    value={
                      report.report.summary.approvedWorkEntries
                    }
                  />

                  <SummaryCard
                    label="Rejected Work"
                    value={
                      report.report.summary.rejectedWorkEntries
                    }
                  />

                  <SummaryCard
                    label="Pending Work"
                    value={
                      report.report.summary.pendingWorkEntries
                    }
                  />

                  <SummaryCard
                    label="Total Production"
                    value={
                      report.report.summary.totalProduction
                    }
                  />

                  <SummaryCard
                    label="Quantity Sold"
                    value={
                      report.report.summary.totalSalesQuantity
                    }
                  />

                  <SummaryCard
                    label="Active Sales"
                    value={
                      report.report.summary.totalActiveSales
                    }
                  />

                  <SummaryCard
                    label="Voided Sales"
                    value={
                      report.report.summary.totalVoidedSales
                    }
                  />
                </div>
              </section>

              {/* INVENTORY */}
              <ReportTable
                title="Inventory"
                description="Current active product inventory."
              >
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#f1dfd2] bg-[#fffaf6] text-left">
                      <TableHeader>Product</TableHeader>
                      <TableHeader>Code</TableHeader>
                      <TableHeader>Stock</TableHeader>
                      <TableHeader>Threshold</TableHeader>
                      <TableHeader>Status</TableHeader>
                    </tr>
                  </thead>

                  <tbody>
                    {report.report.inventory.products.length === 0 ? (
                      <EmptyTableRow
                        colSpan={5}
                        text="No inventory records found."
                      />
                    ) : (
                      report.report.inventory.products.map(
                        (product) => (
                          <tr
                            key={product.id}
                            className="border-b border-[#f4e8df] last:border-b-0"
                          >
                            <TableCell strong>
                              {product.name}
                            </TableCell>

                            <TableCell>
                              {product.code || "—"}
                            </TableCell>

                            <TableCell strong>
                              {product.stock}
                            </TableCell>

                            <TableCell>
                              {product.lowStockThreshold}
                            </TableCell>

                            <td className="px-6 py-4">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  product.isLowStock
                                    ? "bg-red-100 text-red-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {product.isLowStock
                                  ? "Low Stock"
                                  : "Normal"}
                              </span>
                            </td>
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </ReportTable>

              {/* WORK ENTRIES */}
              <ReportTable
                title="Work Entries"
                description="Work submitted during the selected period."
              >
                <table className="w-full min-w-[850px]">
                  <thead>
                    <tr className="border-b border-[#f1dfd2] bg-[#fffaf6] text-left">
                      <TableHeader>Date</TableHeader>
                      <TableHeader>Worker</TableHeader>
                      <TableHeader>Product</TableHeader>
                      <TableHeader>Quantity</TableHeader>
                      <TableHeader>Status</TableHeader>
                    </tr>
                  </thead>

                  <tbody>
                    {report.report.workEntries.length === 0 ? (
                      <EmptyTableRow
                        colSpan={5}
                        text="No work entries found for the selected filters."
                      />
                    ) : (
                      report.report.workEntries.map(
                        (entry) => (
                          <tr
                            key={entry.id}
                            className="border-b border-[#f4e8df] last:border-b-0"
                          >
                            <TableCell>
                              {formatDateTime(
                                entry.submittedAt
                              )}
                            </TableCell>

                            <td className="px-6 py-4">
                              <p className="text-sm font-semibold text-[#3b2117]">
                                {entry.worker.name}
                              </p>

                              <p className="text-xs text-[#8b6b5a]">
                                {entry.worker.username}
                              </p>
                            </td>

                            <TableCell>
                              {entry.product.name}
                            </TableCell>

                            <TableCell strong>
                              {entry.quantity}
                            </TableCell>

                            <TableCell strong>
                              {formatStatus(entry.status)}
                            </TableCell>
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </ReportTable>

              {/* SALES */}
              <ReportTable
                title="Sales"
                description="Sales activity during the selected period."
              >
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b border-[#f1dfd2] bg-[#fffaf6] text-left">
                      <TableHeader>Date</TableHeader>
                      <TableHeader>Customer</TableHeader>
                      <TableHeader>Product</TableHeader>
                      <TableHeader>Quantity</TableHeader>
                      <TableHeader>Status</TableHeader>
                    </tr>
                  </thead>

                  <tbody>
                    {report.report.sales.length === 0 ? (
                      <EmptyTableRow
                        colSpan={5}
                        text="No sales found for the selected filters."
                      />
                    ) : (
                      report.report.sales.map(
                        (sale) => (
                          <tr
                            key={sale.id}
                            className="border-b border-[#f4e8df] last:border-b-0"
                          >
                            <TableCell>
                              {formatDateTime(
                                sale.saleDate
                              )}
                            </TableCell>

                            <TableCell strong>
                              {sale.customerName}
                            </TableCell>

                            <TableCell>
                              {sale.product.name}
                            </TableCell>

                            <TableCell strong>
                              {sale.quantity}
                            </TableCell>

                            <TableCell strong>
                              {formatStatus(sale.status)}
                            </TableCell>
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </ReportTable>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ReportInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#a66a4a]">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-[#3b2117]">
        {value}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-[#f1dfd2] bg-[#fffaf6] p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#a66a4a]">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-[#3b2117]">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function ReportTable({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#f1dfd2] bg-white shadow-sm">
      <div className="border-b border-[#f1dfd2] px-6 py-5">
        <h2 className="text-lg font-bold text-[#3b2117]">
          {title}
        </h2>

        <p className="mt-1 text-sm text-[#7b5a49]">
          {description}
        </p>
      </div>

      <div className="overflow-x-auto">
        {children}
      </div>
    </section>
  );
}

function TableHeader({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
      {children}
    </th>
  );
}

function TableCell({
  children,
  strong = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      className={`px-6 py-4 text-sm ${
        strong
          ? "font-semibold text-[#3b2117]"
          : "text-[#5b3928]"
      }`}
    >
      {children}
    </td>
  );
}

function EmptyTableRow({
  colSpan,
  text,
}: {
  colSpan: number;
  text: string;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-6 py-10 text-center text-sm text-[#8b6b5a]"
      >
        {text}
      </td>
    </tr>
  );
}