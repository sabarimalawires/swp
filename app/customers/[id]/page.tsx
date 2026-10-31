"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/src/components/Sidebar";
import { authClient } from "@/src/lib/auth-client";

type Sale = {

  id: string;
  amount: number;
  weight: number;
  quantity: number;
  saleDate: string;
};

type Payment = {

  id: string;
  amount: number;
  paymentDate: string;
  note: string | null;
  createdBy: {

    name: string;
    username: string;

  };
};

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
  totalPurchases: number;
  totalPaid: number;
  pendingBalance: number;
  customerCredit: number;
  netBalance: number;
  sales: Sale[];
  payments: Payment[];

  // WhatsApp due reminder settings
  whatsappDueRemindersOptIn: boolean;
  whatsappDueRemindersOptInAt: string | null;
};

const money = (value: number) =>

  `₹${Number(value).toLocaleString("en-IN", {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,

  })}`;

const getLocalDateInputValue = () => {

  const today = new Date();

  const year = today.getFullYear();

  const month = String(today.getMonth() + 1).padStart(2, "0");

  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;

};

const formatDate = (value: string | Date) => {

  const dateValue =

    typeof value === "string"

      ? value.slice(0, 10)

      : [

          value.getFullYear(),

          String(value.getMonth() + 1).padStart(2, "0"),

          String(value.getDate()).padStart(2, "0"),

        ].join("-");

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);

  if (!match) return "—";

  return `${match[3]}-${match[2]}-${match[1]}`;

};

export default function CustomerPage() {

  const router = useRouter();

  const params = useParams();

  const customerId = params.id as string;

  const [customer, setCustomer] =

    useState<Customer | null>(null);

  const [userName, setUserName] =

    useState("");

const [showProfileForm, setShowProfileForm] =

  useState(false);

const [profileName, setProfileName] =

  useState("");

const [profilePhone, setProfilePhone] =

  useState("");

const [savingProfile, setSavingProfile] = useState(false);

const [savingWhatsApp, setSavingWhatsApp] = useState(false);

  const [loading, setLoading] =

    useState(true);

  const [saving, setSaving] =

    useState(false);

  const [showPaymentForm, setShowPaymentForm] =

    useState(false);
    const paymentHistoryRef = useRef<HTMLElement>(null);

  const [paymentAmount, setPaymentAmount] =

    useState("");

  const [paymentDate, setPaymentDate] = useState(

  () => getLocalDateInputValue()

);

  const [paymentNote, setPaymentNote] =

    useState("");

  const [editingPaymentId, setEditingPaymentId] =

    useState<string | null>(null);

  const [editingPaymentAmount, setEditingPaymentAmount] =

    useState("");

  const [editingPaymentDate, setEditingPaymentDate] = useState("");

  const [editingPaymentNote, setEditingPaymentNote] =

    useState("");

  const [error, setError] =

    useState("");

  const [success, setSuccess] =

    useState("");

  const loadCustomer = async () => {

  const response = await fetch("/api/customers");

    const result =

      await response.json();

    if (!response.ok) {

      throw new Error(

        result.error ||

          "Failed to load customer."

      );

    }

    const foundCustomer =

      result.find(

        (item: Customer) =>

          item.id === customerId

      );

    if (!foundCustomer) {

      throw new Error(

        "Customer not found."

      );

    }

    setCustomer(foundCustomer);

  };

const handleSaveProfile = async (

  event: React.FormEvent<HTMLFormElement>

) => {

  event.preventDefault();

  if (!customer) return;

  setError("");

  setSuccess("");

  const name = profileName.trim();

  const phone = profilePhone.trim();

  if (!name) {

    setError("Customer name is required.");

    return;

  }

  if (name.length > 200) {

    setError(

      "Customer name must be 200 characters or less."

    );

    return;

  }

  if (phone && !/^[0-9+\s()-]{7,20}$/.test(phone)) {
    setError("Enter a valid mobile number.");
    return;
  }

  if (!customer) {
    setError("Customer not found.");
    return;
  }

  setSavingProfile(true);

  try {

    const response = await fetch(

      `/api/customers/${customer.id}/profile`,

      {

        method: "PATCH",

        headers: {

          "Content-Type": "application/json",

        },

        body: JSON.stringify({

          name,
          phone: phone || null,

        }),

      }

    );

    const result = await response.json();

    if (!response.ok) {

      throw new Error(

        result.error || "Failed to update customer."

      );

    }

    await loadCustomer();

    setShowProfileForm(false);

    setSuccess("Customer details updated successfully.");
  } catch (error: unknown) {
    setError(
      error instanceof Error
        ? error.message
        : "An unexpected error occurred."
    );
  } finally {
    setSavingProfile(false);
  }
};

const handleWhatsAppToggle = async () => {
  if (!customer || savingWhatsApp) return;

  const enabled = !customer.whatsappDueRemindersOptIn;

  if (enabled && !customer.phone) {
    setError("Add a mobile number before enabling WhatsApp reminders.");
    return;
  }

  setSavingWhatsApp(true);
  setError("");
  setSuccess("");

  try {
    const response = await fetch(
      `/api/customers/${customer.id}/whatsapp-reminders`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not update WhatsApp setting.");
    }

    setCustomer((current) =>
      current
        ? {
            ...current,
            whatsappDueRemindersOptIn: result.whatsappDueRemindersOptIn,
            whatsappDueRemindersOptInAt:
              result.whatsappDueRemindersOptInAt,
          }
        : current
    );

    setSuccess(
      enabled
        ? "WhatsApp reminders enabled for this customer."
        : "WhatsApp reminders disabled for this customer."
    );
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Could not update WhatsApp setting."
    );
  } finally {
    setSavingWhatsApp(false);
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

        await loadCustomer();

        setLoading(false);

      } catch (error) {

        console.error(error);

        setError(

          error instanceof Error

            ? error.message

            : "Failed to load customer."

        );

        setLoading(false);

      }

    };

    initialize();

  }, [customerId, router]);

  const handlePayment = async (

    event: React.FormEvent<HTMLFormElement>

  ) => {

    event.preventDefault();

    if (!customer) {

      return;

    }

    setError("");

    setSuccess("");

    const amount =

      Number(paymentAmount);

    if (

      !Number.isFinite(amount) ||

      amount <= 0

    ) {

      setError(

        "Enter a valid payment amount."

      );

      return;

    }

    setSaving(true);

    try {

      const response =

        await fetch(

          `/api/customers/${customer.id}/payments`,

          {

            method: "POST",

            headers: {

              "Content-Type":

                "application/json",

            },

            body: JSON.stringify({

  amount,

  paymentDate,

  note: paymentNote.trim() || null,

}),

          }

        );

      const result =

        await response.json();

      if (!response.ok) {

        setError(

          result.error ||

            "Failed to record payment."

        );

        return;

      }

      setSuccess(
        result.customerCredit > 0
          ? `Payment recorded successfully. Customer credit: ${money(
              result.customerCredit
            )}`
          : result.pendingBalance > 0
            ? `Payment recorded successfully. Remaining balance: ${money(
                result.pendingBalance
              )}`
            : "Payment recorded successfully. Customer balance is Nil."
      );

      setPaymentAmount("");

      setPaymentDate(getLocalDateInputValue());

      setPaymentNote("");

      setShowPaymentForm(false);

      await loadCustomer();

    } catch (error) {

      console.error(

        "Payment submission failed:",

        error

      );

      setError(

        "Something went wrong. Please try again."

      );

    } finally {

      setSaving(false);

    }

  };

  const startEditingPayment = (

    payment: Payment

  ) => {

    setError("");

    setSuccess("");

    setEditingPaymentId(payment.id);

    setEditingPaymentAmount(

      String(payment.amount)

    );

    setEditingPaymentDate(String(payment.paymentDate).slice(0, 10));

    setEditingPaymentNote(

      payment.note ?? ""

    );

    setShowPaymentForm(false);

  };

  const cancelEditingPayment = () => {

    setEditingPaymentId(null);

    setEditingPaymentAmount("");

    setEditingPaymentNote("");

    setEditingPaymentDate("");

  };

  const handleEditPayment = async (

    paymentId: string

  ) => {

    if (!customer) {

      return;

    }

    setError("");

    setSuccess("");

    const amount =

      Number(editingPaymentAmount);

    if (

      !Number.isFinite(amount) ||

      amount <= 0

    ) {

      setError(

        "Enter a valid payment amount."

      );

      return;

    }

    setSaving(true);

    try {

      const response =

        await fetch(

          `/api/customers/${customer.id}/payments`,

          {

            method: "PATCH",

            headers: {

              "Content-Type":

                "application/json",

            },

            body: JSON.stringify({

  paymentId,

  amount,

  paymentDate: editingPaymentDate,

  note: editingPaymentNote.trim() || null,

}),

          }

        );

      const result =

        await response.json();

      if (!response.ok) {

        setError(

          result.error ||

            "Failed to update payment."

        );

        return;

      }

      setSuccess(
        result.customerCredit > 0
          ? `Payment updated successfully. Customer credit: ${money(
              result.customerCredit
            )}`
          : result.pendingBalance > 0
            ? `Payment updated successfully. Remaining balance: ${money(
                result.pendingBalance
              )}`
            : "Payment updated successfully. Customer balance is Nil."
      );

      cancelEditingPayment();

      await loadCustomer();

    } catch (error) {

      console.error(

        "Payment update failed:",

        error

      );

      setError(

        "Something went wrong. Please try again."

      );

    } finally {

      setSaving(false);

    }

  };

const handleDeletePayment = async (paymentId: string) => {

  if (!customer) return;

  const confirmed = window.confirm(

    "Are you sure you want to delete this payment?"

  );

  if (!confirmed) return;

  setSaving(true);

  setError("");

  setSuccess("");

  try {

    const response = await fetch(

      `/api/customers/${customer.id}/payments?paymentId=${encodeURIComponent(paymentId)}`,

      { method: "DELETE" }

    );

    const data = await response.json();

    if (!response.ok) {

      throw new Error(data.error || "Failed to delete payment.");

    }

    cancelEditingPayment();

    await loadCustomer();

    setSuccess("Payment deleted successfully.");

  } catch (error) {

    setError(

      error instanceof Error

        ? error.message

        : "Failed to delete payment."

    );

  } finally {

    setSaving(false);

  }

};

  if (loading) {

    return (

      <main className="flex min-h-screen items-center justify-center bg-[#fff8f2]">

        <p className="text-[#5b2f1f]">

          Loading customer...

        </p>

      </main>

    );

  }

  if (!customer) {

    return (

      <main className="flex min-h-screen items-center justify-center bg-[#fff8f2]">

        <div className="text-center">

          <p className="text-red-600">

            {error ||

              "Customer not found."}

          </p>

          <button

            type="button"

            onClick={() =>

              router.push("/customers")

            }

            className="mt-4 rounded-xl bg-[#d96f2b] px-5 py-2 text-sm font-semibold text-white"

          >

            Back to Customers

          </button>

        </div>

      </main>

    );

  }

  return (

    <div className="swp-customer-detail flex min-h-screen min-w-0 bg-[#fff8f2]">

      <Sidebar />

      <main className="swp-page-main min-w-0 flex-1 p-8">

        <div className="swp-page-content mx-auto max-w-7xl">

          {/* Header */}

          <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">

            <div>

              <button

                type="button"

                onClick={() =>

                  router.push("/customers")

                }

                className="text-sm font-semibold text-[#a66a4a] hover:text-[#d96f2b]"

              >

                ← Back to Customers

              </button>

              <p className="mt-5 text-sm text-[#a66a4a]">

                Customer Account

              </p>

              <h1 className="mt-2 text-3xl font-bold text-[#3b2117]">

                {customer.name}

              </h1>

<div className="mt-3 flex flex-wrap items-center gap-3">

  <p className="text-sm text-[#7b5a49]">

    Mobile: {customer.phone || "Not provided"}

  </p>

  <button

    type="button"

    onClick={() => {

      setProfileName(customer.name);

      setProfilePhone(customer.phone ?? "");

      setError("");

      setSuccess("");

      setShowProfileForm((value) => !value);

    }}

    className="rounded-xl border border-[#e5cdbd] px-4 py-2 text-sm font-semibold text-[#5b3928] hover:bg-[#fff1e6]"

  >

    {showProfileForm ? "Cancel Edit" : "Edit Customer"}

  </button>

  

</div>

              <p className="mt-2 text-[#7b5a49]">

                Complete purchase and payment

                history.

              </p>

            </div>

            <div className="swp-user-chip rounded-xl bg-[#fff1e6] px-4 py-3">

              <p className="text-xs text-[#a66a4a]">

                Signed in as

              </p>

              <p className="font-semibold text-[#3b2117]">

                {userName}

              </p>

            </div>

          </div>

          {/* Messages */}

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

{showProfileForm && (

  <section className="mt-6 rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">

    <h2 className="text-lg font-semibold text-[#3b2117]">

      Edit Customer Details

    </h2>

    <form

      onSubmit={handleSaveProfile}

      className="mt-4 space-y-4"

    >

      <div>

        <label

          htmlFor="profile-name"

          className="mb-2 block text-sm font-semibold text-[#5b3928]"

        >

          Customer Name *

        </label>

        <input

          id="profile-name"

          type="text"

          value={profileName}

          onChange={(event) =>

            setProfileName(event.target.value)

          }

          maxLength={200}

          required

          className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a]"

        />

      </div>

      <div>

        <label

          htmlFor="profile-phone"

          className="mb-2 block text-sm font-semibold text-[#5b3928]"

        >

          Mobile Number

        </label>

        <input

          id="profile-phone"

          type="tel"

          value={profilePhone}

          onChange={(event) =>

            setProfilePhone(event.target.value)

          }

          maxLength={20}

          placeholder="Enter mobile number (optional)"

          className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a]"

        />

      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f1dfd2] bg-white p-4">
  <div>
    <p className="font-semibold text-[#3b2117]">
      WhatsApp Due Reminders
    </p>
    <p className="mt-1 text-sm text-[#7b5a49]">
      {customer.whatsappDueRemindersOptIn
        ? "ON — reminders enabled"
        : "OFF — reminders disabled"}
    </p>
  </div>

  
<button
  type="button"
  role="switch"
  aria-checked={customer.whatsappDueRemindersOptIn}
  disabled={savingWhatsApp}
  onClick={handleWhatsAppToggle}
  aria-label="Toggle WhatsApp due reminders"
  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
    customer.whatsappDueRemindersOptIn
      ? "bg-green-600"
      : "bg-gray-300"
  }`}
>
  <span
    className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
      customer.whatsappDueRemindersOptIn
        ? "translate-x-5"
        : "translate-x-0"
    }`}
  />
</button>

</div>


      <button

        type="submit"

        disabled={savingProfile}

        className="rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#c85f22] disabled:cursor-not-allowed disabled:opacity-60"

      >

        {savingProfile ? "Saving..." : "Save Changes"}

      </button>

    </form>

  </section>

)}

          {/* Summary */}

          <div className="swp-customer-summary mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">

            <div className="rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">

              <p className="text-sm text-[#8b6b5a]">

                Total Purchases

              </p>

              <p className="mt-2 text-2xl font-bold text-[#3b2117]">

                {money(

                  customer.totalPurchases

                )}

              </p>

            </div>

            <div className="rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">

              <p className="text-sm text-[#8b6b5a]">

                Total Paid

              </p>

              <p className="mt-2 text-2xl font-bold text-green-700">

                {money(

                  customer.totalPaid

                )}

              </p>

            </div>

            <div className="rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">
              <p className="text-sm text-[#8b6b5a]">
                Pending Balance
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  customer.customerCredit > 0
                    ? "text-blue-700"
                    : customer.pendingBalance > 0
                      ? "text-red-600"
                      : "text-green-700"
                }`}
              >
                {customer.customerCredit > 0
                  ? `+${money(customer.customerCredit)} (Credit)`
                  : customer.pendingBalance > 0
                    ? money(customer.pendingBalance)
                    : "Nil"}
              </p>
            </div>
          </div>
          <div className="mb-4 mt-3 flex justify-end">
  <button
    type="button"
    onClick={() => {
      setError("");
      setSuccess("");
      cancelEditingPayment();
      setShowPaymentForm(true);

      requestAnimationFrame(() => {
        paymentHistoryRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }}
    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#d96f2b] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c85f22] active:scale-[0.98]"
  >
    <span className="text-lg leading-none">+</span>
    Add Payment
  </button>
</div>

          <div className="mt-6 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6"> 

            {/* Sales */}

            <section className="mt-2 rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm">

              <h2 className="text-lg font-semibold text-[#3b2117]">

                Sales

              </h2>

              <p className="mt-1 text-sm text-[#7b5a49]">

                Active purchases made by this

                customer.

              </p>

              {customer.sales.length === 0 ? (

                <div className="mt-6 rounded-xl bg-[#fffaf6] p-6 text-center text-sm text-[#8b6b5a]">

                  No active sales.

                </div>

              ) : (

                <div className="mt-6 space-y-3">

                  {customer.sales.map(

                    (sale) => (

                      <div

                        key={sale.id}

                        className="rounded-xl border border-[#f1dfd2] bg-[#fffaf6] p-4"

                      >

                        <div className="flex justify-between gap-4">

                          <div>

                            <p className="font-semibold text-[#3b2117]">

                              {sale.quantity}{" "}

                              item

                              {sale.quantity !== 1

                                ? "s"

                                : ""}

                            </p>

                            <p className="mt-1 text-sm text-[#7b5a49]">

                              Weight:{" "}

                              {Number(

                                sale.weight

                              ).toFixed(3)}{" "}

                              kg

                            </p>

                            <p className="mt-1 text-xs text-[#9a7865]">

                              {formatDate(sale.saleDate)}

                            </p>

                          </div>

                          <p className="font-bold text-[#3b2117]">

                            {money(

                              sale.amount

                            )}

                          </p>

                        </div>

                      </div>

                    )

                  )}

                </div>

              )}

            </section>

            {/* Payments */}

            <section
  ref={paymentHistoryRef}
  className="scroll-mt-20 rounded-2xl border border-[#f1dfd2] bg-white p-6 shadow-sm"
>

              <div className="flex flex-wrap items-start justify-between gap-3">

                <div>

                  <h2 className="text-lg font-semibold text-[#3b2117]">

                    Payment History

                  </h2>

                  <p className="mt-1 text-sm text-[#7b5a49]">

                    Payments received from this

                    customer.

                  </p>

                </div>

                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setSuccess("");
                    setShowPaymentForm((value) => !value);
                    cancelEditingPayment();
                  }}
                  className="shrink-0 rounded-xl bg-[#d96f2b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c85f22]"
                >
                  {showPaymentForm ? "Cancel" : "Add Payment"}
                </button>
              </div>

              {/* Add Payment Form */}

              {showPaymentForm && (

                <form

                  onSubmit={handlePayment}

                  className="mt-6 rounded-xl border border-[#f1dfd2] bg-[#fffaf6] p-5"

                >

                  <p className="text-sm font-semibold text-[#5b3928]">

                    Record Payment

                  </p>

                  <p className="mt-1 text-xs text-[#8b6b5a]">
                    {customer.customerCredit > 0 ? (
                      <>
                        Current customer credit:{" "}
                        <span className="font-bold text-blue-700">
                          {money(customer.customerCredit)}
                        </span>
                      </>
                    ) : (
                      <>
                        Current pending:{" "}
                        <span className="font-bold text-red-600">
                          {money(customer.pendingBalance)}
                        </span>
                      </>
                    )}
                  </p>

                  <div className="mt-4">

                    <label

                      htmlFor="payment-amount"

                      className="mb-2 block text-sm font-semibold text-[#5b3928]"

                    >

                      Payment Amount (₹)

                    </label>

                    <input
  id="payment-amount"
  type="number"
  min="0.01"
  step="0.01"
  value={paymentAmount}
  onChange={(event) =>
    setPaymentAmount(event.target.value)
  }
  placeholder="e.g. 5000"
  required
  className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"
/>

                  </div>

<div className="mt-4">

                    <label

                      htmlFor="payment-date"

                      className="mb-2 block text-sm font-semibold text-[#5b3928]"

                    >

                      Payment Date

                    </label>

                    <input

                      id="payment-date"

                      type="date"

                      value={paymentDate}

                      onChange={(event) => setPaymentDate(event.target.value)}

                      required

                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"

                    />

                  </div>

                  <div className="mt-4">

                    <label

                      htmlFor="payment-note"

                      className="mb-2 block text-sm font-semibold text-[#5b3928]"

                    >

                      Note

                    </label>

                    <input

                      id="payment-note"

                      type="text"

                      maxLength={500}

                      value={paymentNote}

                      onChange={(event) =>

                        setPaymentNote(

                          event.target.value

                        )

                      }

                      placeholder="Optional note"

                      className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"

                    />

                  </div>

                  <button

                    type="submit"

                    disabled={saving}

                    className="mt-4 w-full rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#c85f22] disabled:cursor-not-allowed disabled:opacity-60"

                  >

                    {saving

                      ? "Saving..."

                      : "Record Payment"}

                  </button>

                </form>

              )}

              {/* Payment History */}

              {customer.payments.length === 0 ? (

                <div className="mt-6 rounded-xl bg-[#fffaf6] p-6 text-center text-sm text-[#8b6b5a]">

                  No payments recorded yet.

                </div>

              ) : (

                <div className="mt-6 space-y-3">

                  {customer.payments.map(

                    (payment) => {

                      const isEditing =

                        editingPaymentId ===

                        payment.id;

                      return (

                        <div

                          key={payment.id}

                          className="rounded-xl border border-[#f1dfd2] bg-[#fffaf6] p-4"

                        >

                          {isEditing ? (

                            <div>

                              <div className="flex items-center justify-between">

                                <p className="text-sm font-semibold text-[#5b3928]">

                                  Edit Payment

                                </p>

                                <button

                                  type="button"

                                  onClick={

                                    cancelEditingPayment

                                  }

                                  className="text-sm font-semibold text-[#8b6b5a] hover:text-red-600"

                                >

                                  Cancel

                                </button>

                              </div>

                              <div className="mt-4">

                                <label

                                  htmlFor={`edit-payment-${payment.id}`}

                                  className="mb-2 block text-sm font-semibold text-[#5b3928]"

                                >

                                  Amount (₹)

                                </label>

                                <input

                                  id={`edit-payment-${payment.id}`}

                                  type="number"

                                  min="0.01"

                                  step="0.01"

                                  value={

                                    editingPaymentAmount

                                  }

                                  onChange={(event) =>

                                    setEditingPaymentAmount(

                                      event.target.value

                                    )

                                  }

                                  className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"

                                />

                              </div>

                              <div className="mt-4">

                                <label

                                  htmlFor={`edit-payment-date-${payment.id}`}

                                  className="mb-2 block text-sm font-semibold text-[#5b3928]"

                                >

                                  Payment Date

                                </label>

                                <input

                                  id={`edit-payment-date-${payment.id}`}

                                  type="date"

                                  value={editingPaymentDate}

                                  onChange={(event) =>

                                    setEditingPaymentDate(event.target.value)

                                  }

                                  required

                                  className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"

                                />

                              </div>

                              <div className="mt-4">

                                <label

                                  htmlFor={`edit-note-${payment.id}`}

                                  className="mb-2 block text-sm font-semibold text-[#5b3928]"

                                >

                                  Note

                                </label>

                                <input

                                  id={`edit-note-${payment.id}`}

                                  type="text"

                                  maxLength={500}

                                  value={

                                    editingPaymentNote

                                  }

                                  onChange={(event) =>

                                    setEditingPaymentNote(

                                      event.target.value

                                    )

                                  }

                                  className="h-12 w-full rounded-xl border border-[#e8d4c5] bg-white px-4 text-sm text-[#3f2418] outline-none focus:border-[#d9793a] focus:ring-4 focus:ring-[#fce3d0]"

                                />

                              </div>

                              <button

                                type="button"

                                disabled={saving}

                                onClick={() =>

                                  handleEditPayment(

                                    payment.id

                                  )

                                }

                                className="mt-4 w-full rounded-xl bg-[#d96f2b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#c85f22] disabled:cursor-not-allowed disabled:opacity-60"

                              >

                                {saving

                                  ? "Saving..."

                                  : "Save Changes"}

                              </button>

                              <button

  type="button"

  disabled={saving}

  onClick={() => handleDeletePayment(payment.id)}

  className="mt-2 w-full rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"

>

  Delete Payment

</button>

                            </div>

                          ) : (

                            <div className="flex items-start justify-between gap-4">

                              <div>

                                <p className="font-semibold text-green-700">

                                  {money(

                                    payment.amount

                                  )}

                                </p>

                                <p className="mt-1 text-xs text-[#9a7865]">

                                  {formatDate(payment.paymentDate)}

                                </p>

                                {payment.note && (

                                  <p className="mt-2 text-sm text-[#7b5a49]">

                                    {payment.note}

                                  </p>

                                )}

                                <p className="mt-2 text-xs text-[#9a7865]">

                                  Recorded by:{" "}

                                  {

                                    payment

                                      .createdBy

                                      .name

                                  }

                                </p>

                              </div>

                              <div className="flex items-center gap-2">

                                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">

                                  PAID

                                </span>

                                <button

                                  type="button"

                                  onClick={() =>

                                    startEditingPayment(

                                      payment

                                    )

                                  }

                                  className="rounded-lg border border-[#e8d4c5] bg-white px-3 py-1 text-xs font-semibold text-[#7b4a35] hover:bg-[#fff1e6]"

                                >

                                  Edit

                                </button>

                              </div>

                            </div>

                          )}

                        </div>

                      );

                    }

                  )}

                </div>

              )}

            </section>

          </div>

        </div>

      </main>

    </div>

  );

}