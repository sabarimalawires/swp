"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/src/lib/auth-client";
import { useRouter } from "next/navigation";
import Sidebar from "@/src/components/Sidebar";

type Employee = {
  id: string;
  name: string;
  username: string;
  role: string;
  status: string;
};

export default function EmployeesPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [employees, setEmployees] =
    useState<Employee[]>([]);

  const [userName, setUserName] =
    useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [name, setName] =
    useState("");

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [updatingId, setUpdatingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const loadEmployees = async () => {
    const response = await fetch(
      "/api/employees",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const text =
      await response.text();

    if (!text.trim()) {
      throw new Error(
        `Employees API returned an empty response (HTTP ${response.status}).`
      );
    }

    let result: Employee[] & {
      error?: string;
    };

    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(
        `Employees API returned invalid JSON (HTTP ${response.status}).`
      );
    }

    if (!response.ok) {
      throw new Error(
        result.error ||
          "Failed to load employees."
      );
    }

    if (!Array.isArray(result)) {
      throw new Error(
        "Employees API returned an unexpected response."
      );
    }

    setEmployees(result);
  };

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

        const meResponse = await fetch(
          "/api/me/employee",
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            cache: "no-store",
          }
        );

        if (!meResponse.ok) {
          router.replace("/dashboard");
          return;
        }

        const employee =
          await meResponse.json();

        if (employee.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }

        if (cancelled) {
          return;
        }

        setUserName(data.user.name);

        await loadEmployees();
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Employee page loading failed:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load employees."
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

  const handleCreateEmployee = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await fetch(
        "/api/employees",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            username:
              username.trim().toLowerCase(),
            password,
          }),
        }
      );

      const text =
        await response.text();

      if (!text.trim()) {
        throw new Error(
          `Employees API returned an empty response (HTTP ${response.status}).`
        );
      }

      let result: {
        error?: string;
        message?: string;
      };

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(
          `Employees API returned invalid JSON (HTTP ${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to create employee."
        );
      }

      setSuccess(
        "Employee created successfully."
      );

      setName("");
      setUsername("");
      setPassword("");
      setShowForm(false);

      await loadEmployees();
    } catch (error) {
      console.error(
        "Employee creation failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (
    employee: Employee
  ) => {
    const nextStatus =
      employee.status === "ACTIVE"
      ? "DEACTIVATED"
      : "ACTIVE";

    const action =
      nextStatus === "ACTIVE"
        ? "activate"
        : "deactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${employee.name}?`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    setUpdatingId(employee.id);

    try {
      const response = await fetch(
        `/api/employees/${employee.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      const text =
        await response.text();

      if (!text.trim()) {
        throw new Error(
          `Employee API returned an empty response (HTTP ${response.status}).`
        );
      }

      let result: {
        error?: string;
        message?: string;
      };

      try {
        result = JSON.parse(text);
      } catch {
        throw new Error(
          `Employee API returned invalid JSON (HTTP ${response.status}).`
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Failed to update employee."
        );
      }

      setSuccess(
        result.message ||
          "Employee status updated successfully."
      );

      await loadEmployees();
    } catch (error) {
      console.error(
        "Employee status update failed:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to update employee."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setError("");
    setName("");
    setUsername("");
    setPassword("");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8f2]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#f1dfd2] border-t-[#d96f2b]" />

          <p className="mt-4 text-sm font-medium text-[#5b2f1f]">
            Loading employees...
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
                Employees
              </h1>

              <p className="mt-2 text-[#7b5a49]">
                Manage workers and employee access.
              </p>
            </div>

            <div className="rounded-2xl border border-[#f1dfd2] bg-white px-6 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#a66a4a]">
                Signed in as
              </p>

              <p className="mt-1 font-semibold text-[#3b2117]">
                {userName}
              </p>

              <p className="mt-1 text-xs text-[#8b6b5a]">
                Administrator
              </p>
            </div>
          </div>

          {/* MESSAGES */}
          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm font-medium text-green-700">
              {success}
            </div>
          )}

          {/* EMPLOYEE MANAGEMENT */}
          <section className="mt-8 rounded-2xl border border-[#f1dfd2] bg-white shadow-sm">

            {/* SECTION HEADER */}
            <div className="flex flex-col gap-4 border-b border-[#f1dfd2] px-6 py-6 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <h2 className="text-lg font-bold text-[#3b2117]">
                  Employee Management
                </h2>

                <p className="mt-1 text-sm text-[#7b5a49]">
                  Create accounts and manage employee access.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowForm(true);
                  setError("");
                  setSuccess("");
                }}
                className="rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c85f22]"
              >
                Add Employee
              </button>
            </div>

            {/* ADD EMPLOYEE FORM */}
            {showForm && (
              <div className="border-b border-[#f1dfd2] bg-[#fffaf6] p-6">

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-[#3b2117]">
                    Add Employee
                  </h3>

                  <p className="mt-1 text-sm text-[#7b5a49]">
                    Create a new worker account.
                  </p>
                </div>

                <form
                  onSubmit={
                    handleCreateEmployee
                  }
                  className="grid gap-5 md:grid-cols-3"
                >

                  {/* NAME */}
                  <div>
                    <label
                      htmlFor="employee-name"
                      className="mb-2 block text-sm font-semibold text-[#5b3928]"
                    >
                      Name
                    </label>

                    <input
                      id="employee-name"
                      type="text"
                      value={name}
                      onChange={(event) =>
                        setName(
                          event.target.value
                        )
                      }
                      placeholder="Employee name"
                      required
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    />
                  </div>

                  {/* USERNAME */}
                  <div>
                    <label
                      htmlFor="employee-username"
                      className="mb-2 block text-sm font-semibold text-[#5b3928]"
                    >
                      Username
                    </label>

                    <input
                      id="employee-username"
                      type="text"
                      value={username}
                      onChange={(event) =>
                        setUsername(
                          event.target.value
                        )
                      }
                      placeholder="Username"
                      required
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    />
                  </div>

                  {/* PASSWORD */}
                  <div>
                    <label
                      htmlFor="employee-password"
                      className="mb-2 block text-sm font-semibold text-[#5b3928]"
                    >
                      Temporary Password
                    </label>

                    <input
                      id="employee-password"
                      type="password"
                      value={password}
                      onChange={(event) =>
                        setPassword(
                          event.target.value
                        )
                      }
                      placeholder="Minimum 8 characters"
                      minLength={8}
                      required
                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
                    />
                  </div>

                  <div className="flex justify-end gap-3 md:col-span-3">
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={saving}
                      className="rounded-xl border border-[#e8d4c5] bg-white px-5 py-3 text-sm font-semibold text-[#5b3928] transition hover:bg-[#fff1e6] disabled:opacity-60"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c85f22] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? "Creating..."
                        : "Create Employee"}
                    </button>
                  </div>

                </form>
              </div>
            )}

            {/* EMPLOYEE TABLE */}
            <div className="overflow-x-auto">

              {employees.length === 0 ? (
                <div className="p-12 text-center">

                  <p className="font-semibold text-[#5b2f1f]">
                    No employees found.
                  </p>

                  <p className="mt-2 text-sm text-[#8b6b5a]">
                    Use Add Employee to create a worker account.
                  </p>

                </div>
              ) : (
                <table className="w-full min-w-[850px]">

                  <thead>
                    <tr className="border-b border-[#f1dfd2] bg-[#fffaf6] text-left">

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                        Employee
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                        Username
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                        Role
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                        Status
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#8b6b5a]">
                        Action
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {employees.map(
                      (employee) => {
                        const isActive =
                          employee.status ===
                          "ACTIVE";

                        const isAdmin =
                          employee.role ===
                          "ADMIN";

                        const isUpdating =
                          updatingId ===
                          employee.id;

                        return (
                          <tr
                            key={
                              employee.id
                            }
                            className="border-b border-[#f4e8df] last:border-b-0"
                          >

                            {/* EMPLOYEE */}
                            <td className="px-6 py-5">

                              <p className="text-sm font-semibold text-[#3b2117]">
                                {
                                  employee.name
                                }
                              </p>

                              <p className="mt-1 text-xs text-[#8b6b5a]">
                                Employee ID:{" "}
                                {
                                  employee.id
                                }
                              </p>

                            </td>

                            {/* USERNAME */}
                            <td className="px-6 py-5 text-sm text-[#5b3928]">
                              {
                                employee.username
                              }
                            </td>

                            {/* ROLE */}
                            <td className="px-6 py-5">

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  isAdmin
                                    ? "bg-[#f7eee8] text-[#7a4b35]"
                                    : "bg-[#fff1e6] text-[#a66a4a]"
                                }`}
                              >
                                {isAdmin
                                  ? "Administrator"
                                  : "Worker"}
                              </span>

                            </td>

                            {/* STATUS */}
                            <td className="px-6 py-5">

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  isActive
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {isActive
                                  ? "Active"
                                  : "Deactivated"}
                              </span>

                            </td>

                            {/* ACTION */}
                            <td className="px-6 py-5 text-right">

                              {isAdmin ? (
                                <span className="text-xs font-medium text-[#9a7865]">
                                  Protected
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStatusChange(
                                      employee
                                    )
                                  }
                                  disabled={
                                    isUpdating
                                  }
                                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                    isActive
                                      ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                      : "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                  }`}
                                >
                                  {isUpdating
                                    ? "Updating..."
                                    : isActive
                                      ? "Deactivate"
                                      : "Activate"}
                                </button>
                              )}

                            </td>

                          </tr>
                        );
                      }
                    )}

                  </tbody>
                </table>
              )}

            </div>
          </section>

        </div>
      </main>
    </div>
  );
}