"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/src/lib/auth-client";
import { useRouter } from "next/navigation";
import Sidebar from "@/src/components/Sidebar";

type EmployeeRole = "ADMIN" | "WORKER";

type Product = {
  id: string;
  name: string;
  code: string | null;
};

type WorkEntry = {
  id: string;
  quantity: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: string;
  rejectionReason: string | null;
  worker: {
    id: string;
    name: string;
    username: string;
  };
  product: Product;
  approvedBy: {
    id: string;
    name: string;
    username: string;
  } | null;
};

export default function WorkPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState<EmployeeRole | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [entries, setEntries] = useState<WorkEntry[]>([]);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = async (currentRole: EmployeeRole) => {
    try {
      const requests: Promise<Response>[] = [
        fetch("/api/work"),
      ];

      if (currentRole === "WORKER") {
        requests.push(fetch("/api/products"));
      }

      const responses = await Promise.all(requests);

      const workResponse = responses[0];

      if (!workResponse.ok) {
        throw new Error("Failed to load work entries.");
      }

      const workData = await workResponse.json();
      setEntries(workData);

      if (currentRole === "WORKER") {
        const productsResponse = responses[1];

        if (!productsResponse.ok) {
          throw new Error("Failed to load products.");
        }

        const productsData = await productsResponse.json();
        setProducts(productsData);
      }
    } catch {
      setError("Failed to load work entries.");
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const { data } = await authClient.getSession();

      if (!data?.user) {
        router.replace("/");
        return;
      }

      const employeeResponse = await fetch(
        "/api/me/employee"
      );

      if (!employeeResponse.ok) {
        router.replace("/dashboard");
        return;
      }

      const employee = await employeeResponse.json();

      if (
        employee.role !== "ADMIN" &&
        employee.role !== "WORKER"
      ) {
        router.replace("/dashboard");
        return;
      }

      setUserName(data.user.name);
      setRole(employee.role);

      await loadData(employee.role);

      setLoading(false);
    };

    initialize();
  }, [router]);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await fetch("/api/work", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          quantity: Number(quantity),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error || "Failed to submit work entry."
        );
        return;
      }

      setSuccess(
        "Work entry submitted successfully."
      );

      setProductId("");
      setQuantity("");

      await loadData("WORKER");
    } catch {
      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: string) => {
    setError("");
    setSuccess("");
    setProcessingId(id);

    try {
      const response = await fetch(
        `/api/work/${id}/approve`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Failed to approve work entry."
        );
        return;
      }

      setSuccess(
        "Work entry approved successfully."
      );

      await loadData("ADMIN");
    } catch {
      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      setError(
        "Please enter a rejection reason."
      );
      return;
    }

    setError("");
    setSuccess("");
    setProcessingId(id);

    try {
      const response = await fetch(
        `/api/work/${id}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rejectionReason:
              rejectionReason.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ||
            "Failed to reject work entry."
        );
        return;
      }

      setSuccess(
        "Work entry rejected successfully."
      );

      setRejectingId(null);
      setRejectionReason("");

      await loadData("ADMIN");
    } catch {
      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setProcessingId(null);
    }
  };

  if (loading || !role) {
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
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#a66a4a]">
                SWP Business Management System
              </p>

              <h1 className="mt-2 text-3xl font-bold text-[#3b2117]">
                Work Entries
              </h1>

              <p className="mt-2 text-[#7b5a49]">
                {role === "ADMIN"
                  ? "Review and approve employee work."
                  : "Record completed production work."}
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

          {role === "WORKER" ? (
            <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
              {/* Submit Work */}
              <div className="rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-[#3b2117]">
                  Submit Work
                </h2>

                <p className="mt-1 text-sm text-[#7b5a49]">
                  Record the quantity completed.
                </p>

                <form
                  onSubmit={handleSubmit}
                  className="mt-6 space-y-5"
                >
                  <div>
                    <label
                      htmlFor="product"
                      className="mb-2 block text-sm font-semibold text-[#5b3928]"
                    >
                      Product
                    </label>

                    <select
                      id="product"
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

                  <div>
                    <label
                      htmlFor="quantity"
                      className="mb-2 block text-sm font-semibold text-[#5b3928]"
                    >
                      Quantity
                    </label>

                    <input
                      id="quantity"
                      type="number"
                      min="1"
                      step="1"
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

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c85f22] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving
                      ? "Submitting..."
                      : "Submit Work"}
                  </button>
                </form>
              </div>

              {/* Worker History */}
              <div className="rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[#3b2117]">
                      My Work Entries
                    </h2>

                    <p className="mt-1 text-sm text-[#7b5a49]">
                      Your submitted work and approval status.
                    </p>
                  </div>

                  <span className="rounded-full bg-[#fff1e6] px-3 py-1 text-xs font-semibold text-[#a64b2b]">
                    {entries.length} entries
                  </span>
                </div>

                {entries.length === 0 ? (
                  <div className="mt-8 rounded-xl border border-dashed border-[#e5cdbd] bg-[#fffaf6] p-10 text-center">
                    <p className="font-medium text-[#5b2f1f]">
                      No work entries yet.
                    </p>

                    <p className="mt-2 text-sm text-[#8b6b5a]">
                      Submit your first completed work entry.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-[#f1dfd2] bg-[#fffaf6] p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold text-[#3b2117]">
                              {entry.product.name}
                            </p>

                            <p className="mt-1 text-sm text-[#7b5a49]">
                              Quantity:{" "}
                              {entry.quantity}
                            </p>

                            <p className="mt-1 text-xs text-[#9a7865]">
                              {new Date(
                                entry.submittedAt
                              ).toLocaleString()}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              entry.status ===
                              "APPROVED"
                                ? "bg-green-100 text-green-700"
                                : entry.status ===
                                    "REJECTED"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {entry.status}
                          </span>
                        </div>

                        {entry.status ===
                          "REJECTED" &&
                          entry.rejectionReason && (
                            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                              Reason:{" "}
                              {
                                entry.rejectionReason
                              }
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ADMIN */
            <div className="mt-8 rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#3b2117]">
                    Work Review
                  </h2>

                  <p className="mt-1 text-sm text-[#7b5a49]">
                    Review employee submissions.
                  </p>
                </div>

                <span className="rounded-full bg-[#fff1e6] px-3 py-1 text-xs font-semibold text-[#a64b2b]">
                  {entries.length} entries
                </span>
              </div>

              {entries.length === 0 ? (
                <div className="mt-8 rounded-xl border border-dashed border-[#e5cdbd] bg-[#fffaf6] p-10 text-center">
                  <p className="font-medium text-[#5b2f1f]">
                    No work entries yet.
                  </p>

                  <p className="mt-2 text-sm text-[#8b6b5a]">
                    Employee submissions will appear here.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-[#f1dfd2] bg-[#fffaf6] p-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="font-semibold text-[#3b2117]">
                            {entry.product.name}
                          </p>

                          <p className="mt-1 text-sm text-[#5b3928]">
                            Worker:{" "}
                            {entry.worker.name}
                          </p>

                          <p className="text-sm text-[#7b5a49]">
                            Username:{" "}
                            {entry.worker.username}
                          </p>

                          <p className="mt-1 text-sm text-[#7b5a49]">
                            Quantity:{" "}
                            {entry.quantity}
                          </p>

                          <p className="mt-1 text-xs text-[#9a7865]">
                            Submitted:{" "}
                            {new Date(
                              entry.submittedAt
                            ).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              entry.status ===
                              "APPROVED"
                                ? "bg-green-100 text-green-700"
                                : entry.status ===
                                    "REJECTED"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {entry.status}
                          </span>

                          {entry.status ===
                            "PENDING" && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleApprove(
                                    entry.id
                                  )
                                }
                                disabled={
                                  processingId ===
                                  entry.id
                                }
                                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {processingId ===
                                entry.id
                                  ? "Processing..."
                                  : "Approve"}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setRejectingId(
                                    entry.id
                                  );
                                  setRejectionReason(
                                    ""
                                  );
                                  setError("");
                                }}
                                disabled={
                                  processingId ===
                                  entry.id
                                }
                                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {entry.status ===
                        "REJECTED" &&
                        entry.rejectionReason && (
                          <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                            <span className="font-semibold">
                              Rejection reason:
                            </span>{" "}
                            {entry.rejectionReason}
                          </div>
                        )}

                      {entry.status ===
                        "APPROVED" &&
                        entry.approvedBy && (
                          <div className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                            Approved by{" "}
                            <span className="font-semibold">
                              {
                                entry.approvedBy
                                  .name
                              }
                            </span>
                          </div>
                        )}

                      {rejectingId ===
                        entry.id && (
                        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                          <label
                            htmlFor={`reason-${entry.id}`}
                            className="mb-2 block text-sm font-semibold text-red-800"
                          >
                            Rejection Reason
                          </label>

                          <textarea
                            id={`reason-${entry.id}`}
                            value={rejectionReason}
                            onChange={(event) =>
                              setRejectionReason(
                                event.target
                                  .value
                              )
                            }
                            placeholder="Explain why this work entry is being rejected."
                            rows={3}
                            className="w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-[#3f2418] outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100"
                          />

                          <div className="mt-3 flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(
                                  null
                                );
                                setRejectionReason(
                                  ""
                                );
                              }}
                              className="rounded-xl border border-[#e8d4c5] bg-white px-4 py-2 text-sm font-semibold text-[#5b3928] transition hover:bg-[#fff1e6]"
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleReject(
                                  entry.id
                                )
                              }
                              disabled={
                                processingId ===
                                entry.id
                              }
                              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {processingId ===
                              entry.id
                                ? "Rejecting..."
                                : "Confirm Rejection"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}