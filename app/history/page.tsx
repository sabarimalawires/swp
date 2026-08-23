"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/src/components/Sidebar";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    username: string;
  } | null;
};

type AuditResponse = {
  auditLogs: AuditLog[];
  pagination: {
    page: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

const actionOptions = [
  "ALL",
  "CREATE",
  "UPDATE",
  "DEACTIVATE",
  "REACTIVATE",
  "APPROVE",
  "REJECT",
  "VOID",
];

const entityOptions = [
  "ALL",
  "USER",
  "PRODUCT",
  "WORK_ENTRY",
  "SALE",
  "INVENTORY",
];

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function getActionColor(action: string) {
  switch (action) {
    case "APPROVE":
      return "bg-green-100 text-green-700";

    case "REJECT":
      return "bg-red-100 text-red-700";

    case "VOID":
      return "bg-purple-100 text-purple-700";

    case "UPDATE":
      return "bg-blue-100 text-blue-700";

    case "CREATE":
      return "bg-orange-100 text-orange-700";

    case "DEACTIVATE":
      return "bg-red-100 text-red-700";

    case "REACTIVATE":
      return "bg-green-100 text-green-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getValue(
  value: Record<string, unknown> | null | undefined,
  key: string
) {
  return value?.[key];
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return String(value);
  }

  return "—";
}

function getReadableDetails(log: AuditLog) {
  const oldValue = log.oldValue ?? {};
  const newValue = log.newValue ?? {};

  const productName =
    getValue(newValue, "productName") ??
    getValue(oldValue, "productName");

  const quantity =
    getValue(newValue, "quantity") ??
    getValue(oldValue, "quantity");

  const rejectionReason =
    getValue(newValue, "rejectionReason");

  const adjustmentType =
    getValue(newValue, "adjustmentType");

  const oldStatus = getValue(oldValue, "status");
  const newStatus = getValue(newValue, "status");

  const oldStock = getValue(oldValue, "stock");
  const newStock = getValue(newValue, "stock");

  const details: string[] = [];

  if (productName !== undefined) {
    details.push(`Product: ${formatValue(productName)}`);
  }

  if (quantity !== undefined) {
    details.push(`Qty: ${formatValue(quantity)}`);
  }

  if (
    oldStatus !== undefined ||
    newStatus !== undefined
  ) {
    details.push(
      `Status: ${formatValue(oldStatus)} → ${formatValue(
        newStatus
      )}`
    );
  }

  if (
    oldStock !== undefined ||
    newStock !== undefined
  ) {
    details.push(
      `Stock: ${formatValue(oldStock)} → ${formatValue(
        newStock
      )}`
    );
  }

  if (adjustmentType !== undefined) {
    const adjustment =
      adjustmentType === "ADD"
        ? "+"
        : adjustmentType === "REMOVE"
        ? "-"
        : "";

    details.push(
      `Adjustment: ${adjustment}${formatValue(
        quantity
      )}`
    );
  }

  if (rejectionReason !== undefined) {
    details.push(
      `Reason: ${formatValue(rejectionReason)}`
    );
  }

  if (details.length === 0) {
    return "No additional details";
  }

  return details.join(" · ");
}

export default function HistoryPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [data, setData] =
    useState<AuditResponse | null>(null);

  const [page, setPage] = useState(1);
  const [action, setAction] = useState("ALL");
  const [entityType, setEntityType] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();

        params.set("page", String(page));

        if (action !== "ALL") {
          params.set("action", action);
        }

        if (entityType !== "ALL") {
          params.set("entityType", entityType);
        }

        if (from) {
          params.set("from", from);
        }

        if (to) {
          params.set("to", to);
        }

        const response = await fetch(
          `/api/audit?${params.toString()}`
        );

        if (response.status === 401) {
          router.replace("/");
          return;
        }

        if (response.status === 403) {
          router.replace("/dashboard");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          setError(
            result.error ||
              "Failed to load audit history."
          );
          return;
        }

        setData(result);
      } catch {
        setError(
          "Something went wrong. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [
    page,
    action,
    entityType,
    from,
    to,
    router,
  ]);

  const handleClearFilters = () => {
    setAction("ALL");
    setEntityType("ALL");
    setFrom("");
    setTo("");
    setPage(1);
  };

  return (
    <div className="flex min-h-screen bg-[#fff8f2]">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div>
            <p className="text-sm text-[#a66a4a]">
              SWP Business Management System
            </p>

            <h1 className="mt-2 text-3xl font-bold text-[#3b2117]">
              Activity History
            </h1>

            <p className="mt-2 text-[#7b5a49]">
              Track important actions performed in
              the system.
            </p>
          </div>

          {/* Filters */}
          <div className="mt-8 rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label
                  htmlFor="history-action"
                  className="mb-2 block text-sm font-semibold text-[#5b3928]"
                >
                  Action
                </label>

                <select
                  id="history-action"
                  value={action}
                  onChange={(event) => {
                    setAction(event.target.value);
                    setPage(1);
                  }}
                  className="h-11 rounded-xl border border-[#e8d4c5] bg-white px-3 text-sm text-[#3f2418] outline-none focus:border-[#d9793a]"
                >
                  {actionOptions.map((option) => (
                    <option
                      key={option}
                      value={option}
                    >
                      {option === "ALL"
                        ? "All actions"
                        : formatLabel(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="history-entity"
                  className="mb-2 block text-sm font-semibold text-[#5b3928]"
                >
                  Area
                </label>

                <select
                  id="history-entity"
                  value={entityType}
                  onChange={(event) => {
                    setEntityType(event.target.value);
                    setPage(1);
                  }}
                  className="h-11 rounded-xl border border-[#e8d4c5] bg-white px-3 text-sm text-[#3f2418] outline-none focus:border-[#d9793a]"
                >
                  {entityOptions.map((option) => (
                    <option
                      key={option}
                      value={option}
                    >
                      {option === "ALL"
                        ? "All areas"
                        : formatLabel(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="history-from"
                  className="mb-2 block text-sm font-semibold text-[#5b3928]"
                >
                  From
                </label>

                <input
                  id="history-from"
                  type="date"
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value);
                    setPage(1);
                  }}
                  className="h-11 rounded-xl border border-[#e8d4c5] bg-white px-3 text-sm text-[#3f2418] outline-none focus:border-[#d9793a]"
                />
              </div>

              <div>
                <label
                  htmlFor="history-to"
                  className="mb-2 block text-sm font-semibold text-[#5b3928]"
                >
                  To
                </label>

                <input
                  id="history-to"
                  type="date"
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value);
                    setPage(1);
                  }}
                  className="h-11 rounded-xl border border-[#e8d4c5] bg-white px-3 text-sm text-[#3f2418] outline-none focus:border-[#d9793a]"
                />
              </div>

              <button
                type="button"
                onClick={handleClearFilters}
                className="h-11 rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm font-semibold text-[#5b3928] transition hover:bg-[#fff1e6]"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Table */}
          <div className="mt-8 rounded-2xl border border-[#f1dfd2] bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-[#f1dfd2] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#3b2117]">
                  Business Activity
                </h2>

                <p className="mt-1 text-sm text-[#7b5a49]">
                  {data?.pagination.totalRecords ?? 0}{" "}
                  total records
                </p>
              </div>

              {data &&
                data.pagination.totalPages > 0 && (
                  <p className="text-sm text-[#7b5a49]">
                    Page {data.pagination.page} of{" "}
                    {data.pagination.totalPages}
                  </p>
                )}
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <p className="text-[#5b2f1f]">
                  Loading history...
                </p>
              </div>
            ) : !data ||
              data.auditLogs.length === 0 ? (
              <div className="p-12 text-center">
                <p className="font-medium text-[#5b2f1f]">
                  No activity found.
                </p>

                <p className="mt-2 text-sm text-[#8b6b5a]">
                  Try changing or clearing your
                  filters.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-[#f1dfd2] bg-[#fffaf6] text-left">
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                          Date & Time
                        </th>

                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                          User
                        </th>

                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                          Action
                        </th>

                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                          Area
                        </th>

                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                          Details
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {data.auditLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-b border-[#f4e8df] last:border-b-0 hover:bg-[#fffaf6]"
                        >
                          <td className="whitespace-nowrap px-6 py-5 text-sm text-[#5b3928]">
                            {formatDate(log.createdAt)}
                          </td>

                          <td className="px-6 py-5">
                            <p className="text-sm font-semibold text-[#3b2117]">
                              {log.user?.name ||
                                "System"}
                            </p>

                            {log.user?.username && (
                              <p className="mt-1 text-xs text-[#8b6b5a]">
                                {log.user.username}
                              </p>
                            )}
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getActionColor(
                                log.action
                              )}`}
                            >
                              {formatLabel(
                                log.action
                              )}
                            </span>
                          </td>

                          <td className="px-6 py-5 text-sm font-medium text-[#5b3928]">
                            {formatLabel(
                              log.entityType
                            )}
                          </td>

                          <td className="px-6 py-5 text-sm leading-6 text-[#5b3928]">
                            {getReadableDetails(log)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col items-center justify-between gap-4 border-t border-[#f1dfd2] px-6 py-4 sm:flex-row">
                  <button
                    type="button"
                    disabled={
                      !data.pagination
                        .hasPreviousPage
                    }
                    onClick={() =>
                      setPage((current) =>
                        Math.max(1, current - 1)
                      )
                    }
                    className="rounded-xl border border-[#e8d4c5] bg-white px-4 py-2 text-sm font-semibold text-[#5b3928] transition hover:bg-[#fff1e6] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Previous
                  </button>

                  <p className="text-sm text-[#7b5a49]">
                    Showing{" "}
                    {(data.pagination.page - 1) *
                      data.pagination.pageSize +
                      1}{" "}
                    –{" "}
                    {Math.min(
                      data.pagination.page *
                        data.pagination.pageSize,
                      data.pagination.totalRecords
                    )}{" "}
                    of{" "}
                    {data.pagination.totalRecords}
                  </p>

                  <button
                    type="button"
                    disabled={
                      !data.pagination.hasNextPage
                    }
                    onClick={() =>
                      setPage(
                        (current) => current + 1
                      )
                    }
                    className="rounded-xl bg-[#d96f2b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#c85f22] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}