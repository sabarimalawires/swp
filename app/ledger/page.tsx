
    "use client";

    import { useCallback, useEffect, useState } from "react";
    import Sidebar from "@/src/components/Sidebar";
    import DownloadLedgerPdf from "./DownloadLedgerPdf";



    type LedgerSaleItem = {
      id: string;
      productId: string;
      productName: string;
      quantity: number;
      salesMeasurement: number;
      salesUnit: "KGS" | "SQ_FT" | "R_FT" | "R_MTR";
      rate: number;
      amount: number;
      inventoryDeductionKg: number;
    };

    type LedgerRow = {
      id: string;
      date: string;
      type: "SALE" | "PAYMENT";
      item: string;
      quantity: number | null;
      weight: number | null;
      amount: number;
      paymentReceived: number;
      paymentNote: string | null;
      serialNumber: number;
      balance: number;
      items?: LedgerSaleItem[];
    };

    type CustomerLedger = {
      customer: {
        id: string;
        name: string;
        phone: string | null;
        whatsappDueRemindersOptIn: boolean};
      financialYear: string;
      financialYearStart: string;
      financialYearEnd: string;
      openingBalance: number;
      totalSales: number;
      totalPayments: number;
      closingBalance: number;
      openingBalanceIsManualOverride: boolean;
      rows: LedgerRow[];
    };

    type SupplierLedgerRow = {
  id: string;
  date: string;
  type: "PURCHASE" | "SUPPLIER_PAYMENT";
  item: string;
  invoiceNumber: string | null;
  quantity: number | null;
  weight: number | null;
  amount: number;
  paymentMade: number;
  paymentNote: string | null;
  serialNumber: number;
  balance: number;
  items: {
    id: string;
    productId: string;
    productName: string;
    quantity: number | null;
    weight: number;
    rate: number;
    amount: number;
  }[];
};

type SupplierLedger = {
  supplier: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    gstNumber: string | null;
  };
  financialYear: string;
  financialYearStart: string;
  financialYearEnd: string;
  openingBalance: number;
  totalPurchases: number;
  totalPayments: number;
    closingBalance: number;
  openingBalanceIsManualOverride: boolean;
  rows: SupplierLedgerRow[];
};

type LedgerResponse = {
  financialYear: string;
  summary: {
    customerCount: number;
    openingBalance: number;
    totalSales: number;
    totalPayments: number;
    closingBalance: number;
  };
  supplierSummary: {
    supplierCount: number;
    openingBalance: number;
    totalPurchases: number;
    totalPayments: number;
    closingBalance: number;
  };
  ledgers: CustomerLedger[];
  supplierLedgers: SupplierLedger[];
};

    const currency = (value: number) =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(value);
      const salesUnitLabels: Record<LedgerSaleItem["salesUnit"], string> = {
      KGS: "kg",
      SQ_FT: "Sq.ft",
      R_FT: "R.ft",
      R_MTR: "R.m",
    };

    const dateText = (value: string) =>
      new Date(value).toLocaleDateString("en-IN");

    export default function LedgerPage() {
      const currentYear = new Date().getFullYear();
      const defaultYear =
        new Date().getMonth() < 3 ? currentYear - 1 : currentYear;

      const [year, setYear] = useState(defaultYear);
      const [ledgerType, setLedgerType] = useState<
  "CUSTOMER" | "SUPPLIER" | "COMBINED"
>("COMBINED");

const [selectedCustomer, setSelectedCustomer] = useState("ALL");
const [selectedSupplier, setSelectedSupplier] = useState("ALL");
const [supplierOpeningBalanceInput, setSupplierOpeningBalanceInput] =
  useState("");

const [supplierOverrideReason, setSupplierOverrideReason] =
  useState("");

const [savingSupplierOpening, setSavingSupplierOpening] =
  useState(false);

const [supplierOpeningMessage, setSupplierOpeningMessage] =
  useState("");
      const [data, setData] = useState<LedgerResponse | null>(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState("");
      const [openingBalanceInput, setOpeningBalanceInput] = useState("0");
      const [overrideReason, setOverrideReason] = useState("");
      const [savingOpening, setSavingOpening] = useState(false);
      const [openingMessage, setOpeningMessage] = useState("");
      const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
    const [whatsappMessage, setWhatsappMessage] = useState("");

      useEffect(() => {
      setOpeningBalanceInput("");
      setOverrideReason("");
      setOpeningMessage("");
    }, [selectedCustomer, year]);

    useEffect(() => {
  setSupplierOpeningBalanceInput("");
  setSupplierOverrideReason("");
  setSupplierOpeningMessage("");
}, [selectedSupplier, year]);


      const loadLedger = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
          const response = await fetch(`/api/ledger?year=${year}`, {
            cache: "no-store",
          });

          const result = await response.json();

          console.log("REFRESHED LEDGER DATA:", result);

          if (!response.ok) {
            throw new Error(result.error ?? "Unable to load ledger.");
          }

          setData(result);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Unable to load ledger."
          );
        } finally {
          setLoading(false);
        }
      }, [year]);


      useEffect(() => {
        void loadLedger();
      }, [loadLedger]);



      const visibleLedgers =
  data?.ledgers.filter(
    (ledger) =>
      selectedCustomer === "ALL" ||
      ledger.customer.id === selectedCustomer
  ) ?? [];

const visibleSupplierLedgers =
  data?.supplierLedgers.filter(
    (ledger) =>
      selectedSupplier === "ALL" ||
      ledger.supplier.id === selectedSupplier
  ) ?? [];

const combined = ledgerType === "COMBINED";

const selectedLedger =
  ledgerType === "CUSTOMER" &&
  selectedCustomer !== "ALL" &&
  visibleLedgers.length === 1
    ? visibleLedgers[0]
    : null;

const selectedSupplierLedger =
  ledgerType === "SUPPLIER" &&
  selectedSupplier !== "ALL" &&
  visibleSupplierLedgers.length === 1
    ? visibleSupplierLedgers[0]
    : null;
      const saveOpeningBalance = async () => {
        if (selectedCustomer === "ALL") {
          setOpeningMessage("Select an individual customer first.");
          return;
        }

        const balance = Number(openingBalanceInput);

        if (
          openingBalanceInput.trim() === "" ||
          !Number.isFinite(balance)
        ) {
          setOpeningMessage("Enter a valid opening balance.");
          return;
        }

        setSavingOpening(true);
        setOpeningMessage("");

        try {
          const response = await fetch(
            "/api/ledger/opening-balance",
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customerId: selectedCustomer,
                financialYearStart: `${year}-04-01`,
                openingBalance: balance,
                overrideReason: overrideReason.trim(),
              }),
            }
          );

          const result = await response.json();


          if (!response.ok) {
            throw new Error(result.error ?? "Failed to save opening balance.");
          }

          setOpeningBalanceInput("");
    setOverrideReason("");
    setOpeningMessage("Opening balance saved successfully.");
    await loadLedger();
        } catch (err) {
          setOpeningMessage(
            err instanceof Error ? err.message : "Failed to save opening balance."
          );
        } finally {
          setSavingOpening(false);
        }
      };

      const saveSupplierOpeningBalance = async () => {
  if (
    ledgerType !== "SUPPLIER" ||
    selectedSupplier === "ALL"
  ) {
    setSupplierOpeningMessage(
      "Select an individual supplier first."
    );
    return;
  }

  const balance = Number(supplierOpeningBalanceInput);

  if (
    supplierOpeningBalanceInput.trim() === "" ||
    !Number.isFinite(balance)
  ) {
    setSupplierOpeningMessage(
      "Enter a valid opening balance."
    );
    return;
  }

  setSavingSupplierOpening(true);
  setSupplierOpeningMessage("");

  try {
    const response = await fetch(
      "/api/ledger/supplier-opening-balance",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          supplierId: selectedSupplier,
          financialYearStart: `${year}-04-01`,
          openingBalance: balance,
          overrideReason: supplierOverrideReason.trim(),
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ?? "Failed to save supplier opening balance."
      );
    }

    setSupplierOpeningBalanceInput("");
    setSupplierOverrideReason("");

    setSupplierOpeningMessage(
      "Supplier opening balance saved successfully."
    );

    await loadLedger();
  } catch (err) {
    setSupplierOpeningMessage(
      err instanceof Error
        ? err.message
        : "Failed to save supplier opening balance."
    );
  } finally {
    setSavingSupplierOpening(false);
  }
};

    const isValidWhatsAppPhone = (phone: string | null) => {
      if (!phone) return false;

      let digits = phone.replace(/\D/g, "");

      if (/^[6-9]\d{9}$/.test(digits)) {
        digits = `91${digits}`;
      }

      return /^[1-9]\d{7,14}$/.test(digits);
    };

    const canSendWhatsApp =
      !!selectedLedger &&
      selectedLedger.customer.whatsappDueRemindersOptIn &&
      isValidWhatsAppPhone(selectedLedger.customer.phone) &&
      selectedLedger.closingBalance > 0;

    const handleSendWhatsAppNow = async () => {
      if (!selectedLedger || !canSendWhatsApp) return;

      setSendingWhatsApp(true);
      setWhatsappMessage("");

      try {
        const response = await fetch(
          `/api/customers/${selectedLedger.customer.id}/whatsapp-reminders?year=${year}`,
          { method: "POST" }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? "Failed to send WhatsApp reminder.");
        }

        setWhatsappMessage(
          result.testMode
            ? `Test reminder accepted. Ledger closing balance: ${currency(result.closingBalance)}`
            : `Reminder accepted. Ledger closing balance: ${currency(result.closingBalance)}`
        );
      } catch (err) {
        setWhatsappMessage(
          err instanceof Error ? err.message : "Failed to send WhatsApp reminder."
        );
      } finally {
        setSendingWhatsApp(false);
      }
    };

     return (

    <div className="swp-ledger flex min-h-screen bg-[#F2EAD2]">
      <div className="no-print">
        <Sidebar />
      </div>
      <main className="ledger-page min-w-0 flex-1">

        <style jsx global>{`
        .ledger-table .closing-row td:first-child {
  text-align: right;
  padding-right: 12px;
}
      .ledger-page {
        width: 100%;
    max-width: none;
    margin: 0;
    box-sizing: border-box;
        padding: 28px;
        color: #1E3B2F;
        background: #F2EAD2;
        min-height: 100vh;
      }

      .ledger-page header {
        margin-bottom: 24px;
      }

      .ledger-page header h1 {
        color: #1E3B2F;
      }

      .ledger-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        gap: 14px;
        margin: 20px 0;
      }

      .ledger-field {
        display: grid;
        gap: 7px;
        min-width: 190px;
      }

      .ledger-field label {
        font-size: 13px;
        font-weight: 600;
        color: #1E3B2F;
      }

      .ledger-field select,
      .ledger-page input {
        min-height: 42px;
        border: 1px solid #e8cbbb;
        border-radius: 10px;
        padding: 10px 12px;
        background: white;
        color: #1E3B2F;
        font: inherit;
      }

      .ledger-page button {
        border: 1px solid #1E3B2F;
        background: #1E3B2F;
        color: white;
        padding: 11px 17px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 600;
      }

      .ledger-page button:hover:not(:disabled) {
        background: #bd5b20;
      }

      .ledger-page button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .ledger-summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
        margin: 24px 0;
      }

      .ledger-stat,
      .ledger-card,
      .opening-balance-panel {
        border: 1px solid #D5CBB3;
        background: white;
        border-radius: 16px;
        box-shadow: 0 4px 16px #1E3B2F08;
      }

      .ledger-stat {
        padding: 20px;
        min-width: 0;
      }

      .ledger-stat span {
        display: block;
        color: #718477;
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 10px;
      }

      .ledger-stat strong {
        color: #1E3B2F;
        font-size: 19px;
        overflow-wrap: anywhere;
      }

      .ledger-card {
        margin: 24px 0;
        padding: 20px;
        break-inside: avoid;
      }

      .ledger-heading {
        text-align: center;
        margin-bottom: 20px;
        color: #1E3B2F;
      }

      .ledger-heading h2 {
        font-size: 19px;
        margin: 0 0 8px;
      }

      .ledger-heading p {
        color: #80523d;
        font-size: 12px;
      }

      .ledger-table-wrap {
        overflow-x: auto;
        border: 1px solid #D5CBB3;
        border-radius: 10px;
      }

      .ledger-table {
        border-collapse: collapse;
        width: 100%;
        font-size: 12px;
        background: white;
      }

      .ledger-table th,
      .ledger-table td {
        border: 1px solid #D5CBB3;
        padding: 10px 8px;
        text-align: right;
        white-space: nowrap;
      }

      .ledger-table th {
        background: #E5E9DA;
        color: #1E3B2F;
        font-weight: 700;
      }

      .ledger-table th:nth-child(3),
      .ledger-table td:nth-child(3) {
        text-align: left;
        white-space: normal;
        min-width: 150px;
      }

      .ledger-table tbody tr:nth-child(even) {
        background: #F2EAD2;
      }

      .ledger-table .opening-row td,
      .ledger-table .closing-row td {
        font-weight: 700;
        background: #E5E9DA;
        color: #1E3B2F;
      }

      .ledger-muted {
        color: #718477;
        font-size: 13px;
      }

      .opening-balance-panel {
        margin: 24px 0;
        padding: 22px;
      }

      .opening-balance-panel h2 {
        margin: 0 0 8px;
        color: #1E3B2F;
        font-size: 18px;
      }

      @media (max-width: 900px) {
        .ledger-summary {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 767px) {
        .ledger-page {
          width: 100%;
          min-width: 0;
          padding: 14px;
          padding-bottom: 100px;
        }

        .ledger-page header {
          margin-bottom: 18px;
        }

        .ledger-page header h1 {
          font-size: 22px !important;
          line-height: 1.3;
        }

        .ledger-toolbar {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
          margin: 16px 0;
        }

        .ledger-field {
          width: 100%;
          min-width: 0;
        }

        .ledger-field select,
        .ledger-page input {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          min-height: 46px;
        }

        .ledger-toolbar button,
        .ledger-toolbar > * {
          max-width: 100%;
        }

        .ledger-toolbar button {
          width: 100%;
          min-height: 44px;
        }

        .ledger-summary {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 18px 0;
        }

        .ledger-stat {
          padding: 13px;
          border-radius: 12px;
        }

        .ledger-stat span {
          font-size: 11px;
          margin-bottom: 7px;
        }

        .ledger-stat strong {
          font-size: 15px;
          overflow-wrap: anywhere;
        }

        .ledger-card {
          margin: 16px 0;
          padding: 12px;
          border-radius: 12px;
        }

        .ledger-heading {
          margin-bottom: 14px;
        }

        .ledger-heading h2 {
          font-size: 16px;
        }

        .ledger-table-wrap {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 8px;
        }

        /* Eight-column compact ledger: total width approximately 660px */
        .ledger-table {
          width: 660px;
          min-width: 660px;
          table-layout: fixed;
          font-size: 9px;
        }

        .ledger-table th,
        .ledger-table td {
          padding: 6px 4px;
          font-size: 9px;
          line-height: 1.3;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        /* S.No - 34px */
        .ledger-table th:nth-child(1),
        .ledger-table td:nth-child(1) {
          width: 34px;
        }

        /* Date - 65px */
        .ledger-table th:nth-child(2),
        .ledger-table td:nth-child(2) {
          width: 65px;
        }

        /* Particulars - 115px */
        .ledger-table th:nth-child(3),
        .ledger-table td:nth-child(3) {
          width: 115px;
          min-width: 0;
          text-align: left;
        }

        /* Sales Measurement - 85px */
        .ledger-table th:nth-child(4),
        .ledger-table td:nth-child(4) {
          width: 85px;
        }

        /* Rate / Unit - 80px */
        .ledger-table th:nth-child(5),
        .ledger-table td:nth-child(5) {
          width: 80px;
        }

        /* Amount - 90px */
        .ledger-table th:nth-child(6),
        .ledger-table td:nth-child(6) {
          width: 90px;
        }

        /* Payment Received - 95px */
        .ledger-table th:nth-child(7),
        .ledger-table td:nth-child(7) {
          width: 95px;
        }

        /* Balance - 95px */
        .ledger-table th:nth-child(8),
        .ledger-table td:nth-child(8) {
          width: 95px;
        }

        .opening-balance-panel {
          margin: 16px 0;
          padding: 14px;
          border-radius: 12px;
        }

        .opening-balance-panel .ledger-toolbar {
          display: flex;
          flex-direction: column;
        }

        .opening-balance-panel input,
        .opening-balance-panel button {
          width: 100%;
          box-sizing: border-box;
        }
      }

      @media (max-width: 600px) {
        .ledger-page {
          padding: 10px;
          padding-bottom: 100px;
        }

        .ledger-page header {
          margin-bottom: 14px;
        }

        .ledger-summary {
          gap: 8px;
          margin: 14px 0;
        }

        .ledger-stat,
        .ledger-card,
        .opening-balance-panel {
          padding: 10px;
          border-radius: 12px;
        }

        .ledger-stat span {
          font-size: 10px;
          margin-bottom: 5px;
        }

        .ledger-stat strong {
          font-size: 14px;
        }

        .ledger-card {
          margin: 14px 0;
        }

        .ledger-heading {
          margin-bottom: 12px;
        }

        .ledger-heading h2 {
          font-size: 15px;
        }

        .ledger-toolbar {
          gap: 9px;
        }
      }

      @media (max-width: 380px) {
        .ledger-summary {
          grid-template-columns: 1fr;
        }

        .ledger-page {
          padding-left: 10px;
          padding-right: 10px;
        }
      }
    `}
    </style>
          <header>
            <h1 style={{ fontSize: 26, fontWeight: 700 }}>
  {ledgerType === "CUSTOMER"
    ? "Yearly Customer Ledger"
    : ledgerType === "SUPPLIER"
      ? "Yearly Supplier Ledger"
      : "Yearly Combined Business Ledger"}
</h1>

<p className="ledger-muted">
  {ledgerType === "CUSTOMER"
    ? "Customer sales and payment accounts"
    : ledgerType === "SUPPLIER"
      ? "Supplier purchase and payment accounts"
      : "Combined customer and supplier business report"}
</p>
          </header>

          <section className="ledger-toolbar no-print">
            <div className="ledger-field">
              <label htmlFor="financial-year">Financial year</label>
              <select
                id="financial-year"
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
              >
                {Array.from({ length: 10 }, (_, index) => {
                  const startYear = defaultYear - index;
                  return (
                    <option key={startYear} value={startYear}>
                      {startYear}-{String(startYear + 1).slice(-2)}
                    </option>
                  );
                })}
              </select>
            </div>


            <div className="ledger-field">
  <label htmlFor="ledger-type">Ledger Type</label>
  <select
    id="ledger-type"
    value={ledgerType}
    onChange={(event) => {
      setLedgerType(
        event.target.value as "CUSTOMER" | "SUPPLIER" | "COMBINED"
      );
    }}
  >
    <option value="CUSTOMER">Customer Ledger</option>
    <option value="SUPPLIER">Supplier Ledger</option>
    <option value="COMBINED">Combined Business Ledger</option>
  </select>
</div>

{(ledgerType === "CUSTOMER" || ledgerType === "COMBINED") && (
  <div className="ledger-field">
    <label htmlFor="ledger-customer">Customer</label>
    <select
      id="ledger-customer"
      value={selectedCustomer}
      onChange={(event) => setSelectedCustomer(event.target.value)}
    >
      <option value="ALL">All Customers</option>
      {(data?.ledgers ?? []).map((ledger) => (
        <option key={ledger.customer.id} value={ledger.customer.id}>
          {ledger.customer.name}
        </option>
      ))}
    </select>
  </div>
)}

{(ledgerType === "SUPPLIER" || ledgerType === "COMBINED") && (
  <div className="ledger-field">
    <label htmlFor="ledger-supplier">Supplier</label>
    <select
      id="ledger-supplier"
      value={selectedSupplier}
      onChange={(event) => setSelectedSupplier(event.target.value)}
    >
      <option value="ALL">All Suppliers</option>
      {(data?.supplierLedgers ?? []).map((ledger) => (
        <option key={ledger.supplier.id} value={ledger.supplier.id}>
          {ledger.supplier.name}
        </option>
      ))}
    </select>
  </div>
)}

            {data && !loading && !error && (
  <DownloadLedgerPdf
    data={data}
    ledgerType={ledgerType}
    financialYear={`${year}-${String(year + 1).slice(-2)}`}
    customerId={
      ledgerType === "CUSTOMER" && selectedCustomer !== "ALL"
        ? selectedCustomer
        : undefined
    }
    supplierId={
      ledgerType === "SUPPLIER" && selectedSupplier !== "ALL"
        ? selectedSupplier
        : undefined
    }
    customerName={
      visibleLedgers.length === 1
        ? visibleLedgers[0].customer.name
        : undefined
    }
    supplierName={
      visibleSupplierLedgers.length === 1
        ? visibleSupplierLedgers[0].supplier.name
        : undefined
    }
  />
)}

    {ledgerType === "CUSTOMER" && (
  <button
    type="button"
    onClick={() => void handleSendWhatsAppNow()}
    disabled={!canSendWhatsApp || sendingWhatsApp || loading}
    style={{
      backgroundColor: "#25D366",
      borderColor: "#25D366",
      color: "#ffffff",
    }}
  >
    {sendingWhatsApp ? "Sending..." : "Send WhatsApp Now"}
  </button>
)}
                  <button
              type="button"
              className="ledger-button"
              onClick={() => void loadLedger()}
            >
              Refresh
            </button>
          </section>

          {whatsappMessage && (
      <p
        role="status"
        style={{
          marginTop: 8,
          color: "#166534",
          fontWeight: 600,
        }}
      >
        {whatsappMessage}
      </p>
    )}

                {ledgerType === "CUSTOMER" && (
  <section className="opening-balance-panel no-print">
      <h2>Edit Opening Balance</h2>
      <p>
        Select an individual customer and enter the opening balance for the
        selected financial year.
      </p>

      <div className="ledger-toolbar">
        <input
          type="number"
          step="0.01"
          value={openingBalanceInput}
          onChange={(e) => setOpeningBalanceInput(e.target.value)}
          placeholder="Opening balance"
          disabled={savingOpening || selectedCustomer === "ALL"}
        />

        <input
          type="text"
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          placeholder="Reason for adjustment (optional)"
          disabled={savingOpening || selectedCustomer === "ALL"}
        />

        <button
          type="button"
          onClick={() => void saveOpeningBalance()}
          disabled={savingOpening || selectedCustomer === "ALL"}
        >
          {savingOpening ? "Saving..." : "Save Opening Balance"}
        </button>
      </div>

      {selectedCustomer === "ALL" && (
        <p>Select an individual customer to edit their opening balance.</p>
      )}

      {openingMessage && <p>{openingMessage}</p>}
    </section>
                )}
                {ledgerType === "SUPPLIER" &&
  selectedSupplier !== "ALL" &&
  selectedSupplierLedger && (
    <section className="opening-balance-panel no-print">
      <h2>Edit Supplier Opening Balance</h2>

      <p>
        Supplier: <strong>{selectedSupplierLedger.supplier.name}</strong>
      </p>

      <p>
        Automatically calculated opening balance:{" "}
        {currency(selectedSupplierLedger.openingBalance)}
      </p>

      {selectedSupplierLedger.openingBalanceIsManualOverride && (
        <p className="ledger-muted">
          The opening balance has been manually overridden.
        </p>
      )}

      <div className="ledger-toolbar">
        <input
          type="number"
          step="0.01"
          value={supplierOpeningBalanceInput}
          onChange={(event) =>
            setSupplierOpeningBalanceInput(event.target.value)
          }
          placeholder="New opening balance"
          disabled={savingSupplierOpening}
        />

        <input
          type="text"
          value={supplierOverrideReason}
          onChange={(event) =>
            setSupplierOverrideReason(event.target.value)
          }
          placeholder="Reason for adjustment (optional)"
          disabled={savingSupplierOpening}
        />

        <button
          type="button"
          onClick={() => void saveSupplierOpeningBalance()}
          disabled={
            savingSupplierOpening ||
            supplierOpeningBalanceInput.trim() === ""
          }
        >
          {savingSupplierOpening
            ? "Saving..."
            : "Save Supplier Opening Balance"}
        </button>
      </div>

      {supplierOpeningMessage && (
        <p role="status">{supplierOpeningMessage}</p>
      )}
    </section>
  )}

          {loading && <p>Loading ledger...</p>}

          {error && (
            <div role="alert" style={{ color: "#b00020", margin: "16px 0" }}>
              {error}
              <button
                type="button"
                className="ledger-button no-print"
                style={{ marginLeft: 12 }}
                onClick={() => void loadLedger()}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <>
                            {ledgerType === "CUSTOMER" && (
  <section className="ledger-summary">
    <div className="ledger-stat">
      <span>Opening Balance</span>
      <strong>
        {currency(visibleLedgers[0]?.openingBalance ?? 0)}
      </strong>
    </div>

    <div className="ledger-stat">
      <span>Total Sales</span>
      <strong>
        {currency(visibleLedgers[0]?.totalSales ?? 0)}
      </strong>
    </div>

    <div className="ledger-stat">
      <span>Payments Received</span>
      <strong>
        {currency(visibleLedgers[0]?.totalPayments ?? 0)}
      </strong>
    </div>

    <div className="ledger-stat">
      <span>Closing Balance</span>
      <strong>
        {currency(visibleLedgers[0]?.closingBalance ?? 0)}
      </strong>
    </div>
  </section>
)}

{ledgerType === "SUPPLIER" && (
  <section className="ledger-summary">
    <div className="ledger-stat">
      <span>Opening Balance</span>
      <strong>
        {currency(visibleSupplierLedgers[0]?.openingBalance ?? 0)}
      </strong>
    </div>

    <div className="ledger-stat">
      <span>Total Purchases</span>
      <strong>
        {currency(visibleSupplierLedgers[0]?.totalPurchases ?? 0)}
      </strong>
    </div>

    <div className="ledger-stat">
      <span>Payments Made</span>
      <strong>
        {currency(visibleSupplierLedgers[0]?.totalPayments ?? 0)}
      </strong>
    </div>

    <div className="ledger-stat">
      <span>Closing Balance</span>
      <strong>
        {currency(visibleSupplierLedgers[0]?.closingBalance ?? 0)}
      </strong>
    </div>
  </section>
)}

{ledgerType === "COMBINED" && (
  <section className="ledger-summary">
    <div className="ledger-stat">
      <span>Customer Closing Balance</span>
      <strong>{currency(data.summary.closingBalance)}</strong>
    </div>

    <div className="ledger-stat">
      <span>Supplier Closing Balance</span>
      <strong>{currency(data.supplierSummary.closingBalance)}</strong>
    </div>

    <div className="ledger-stat">
      <span>Total Sales</span>
      <strong>{currency(data.summary.totalSales)}</strong>
    </div>

    <div className="ledger-stat">
      <span>Total Purchases</span>
      <strong>{currency(data.supplierSummary.totalPurchases)}</strong>
    </div>
  </section>
)}

              {(ledgerType === "CUSTOMER" || ledgerType === "COMBINED") &&
  visibleLedgers.length === 0 && (
    <p>No customer ledgers found for this financial year.</p>
  )}

              {(ledgerType === "CUSTOMER" || ledgerType === "COMBINED") &&
  visibleLedgers.map((ledger) => (
                <section className="ledger-card" key={ledger.customer.id}>
                  <div className="ledger-heading">
                    <h2>
                      {combined
                        ? ledger.customer.name
                        : "CUSTOMER SALES LEDGER"}
                    </h2>
                    <p>
                      Financial Year: {ledger.financialYear}
                    </p>
                    {!combined && (
                      <p>Customer: {ledger.customer.name}</p>
                    )}
                  </div>

                  <div className="ledger-table-wrap">
                    <table className="ledger-table">
      <thead>
        <tr>
          <th>S.No</th>
          <th>Date</th>
          <th>Item / Particulars</th>
          <th>Sales Unit</th>
          <th>Rate / Unit</th>
          <th>Amount</th>
          <th>Payment Received</th>
          <th>Balance</th>
        </tr>
      </thead>

      <tbody>
        <tr className="opening-row">
          <td>-</td>
          <td>{dateText(ledger.financialYearStart)}</td>
          <td>Opening Balance</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>{currency(ledger.openingBalance)}</td>
        </tr>

        {ledger.rows.map((row) => (
          <tr key={`${row.type}-${row.id}`}>
            <td>{row.serialNumber}</td>
            <td>{dateText(row.date)}</td>

            <td>
              {row.type === "SALE" && row.items?.length ? (
                <div>
                  {row.items.map((item) => (
                    <div key={item.id} style={{ marginBottom: 5 }}>
                      {item.productName}
                    </div>
                  ))}
                </div>
              ) : (
                row.item || row.paymentNote || "-"
              )}
            </td>

            <td>
              {row.type === "SALE" && row.items?.length ? (
                <div>
                  {row.items.map((item) => (
                    <div key={item.id} style={{ marginBottom: 5 }}>
                      {item.salesMeasurement.toFixed(3)}{" "}
                      {salesUnitLabels[item.salesUnit]}
                    </div>
                  ))}
                </div>
              ) : row.type === "SALE" ? (
                `${(row.weight ?? 0).toFixed(3)} kg`
              ) : (
                "-"
              )}
            </td>

            <td>
              {row.type === "SALE" && row.items?.length ? (
                <div>
                  {row.items.map((item) => (
                    <div key={item.id} style={{ marginBottom: 5 }}>
                      {currency(item.rate)} /{" "}
                      {salesUnitLabels[item.salesUnit]}
                    </div>
                  ))}
                </div>
              ) : (
                "-"
              )}
            </td>

            <td>
              {row.type === "SALE" ? currency(row.amount) : "-"}
            </td>

            <td>
              {row.type === "PAYMENT"
                ? currency(row.paymentReceived)
                : "-"}
            </td>

            <td>{currency(row.balance)}</td>
          </tr>
        ))}

        <tr className="closing-row">
          <td colSpan={5}>Closing Balance</td>
          <td>{currency(ledger.totalSales)}</td>
          <td>{currency(ledger.totalPayments)}</td>
          <td>{currency(ledger.closingBalance)}</td>
        </tr>
      </tbody>
    </table>
                  </div>

                  {ledger.openingBalanceIsManualOverride && (
                    <p className="ledger-muted">
                      Opening balance manually overridden by an administrator.
                    </p>
                  )}
                </section>
              ))}
              {(ledgerType === "SUPPLIER" || ledgerType === "COMBINED") && (
  <>
    {visibleSupplierLedgers.length === 0 && (
      <p>No supplier ledgers found for this financial year.</p>
    )}

    {visibleSupplierLedgers.map((ledger) => (
      <section className="ledger-card" key={ledger.supplier.id}>
        <div className="ledger-heading">
          <h2>
            {ledgerType === "COMBINED"
              ? ledger.supplier.name
              : "SUPPLIER PURCHASE LEDGER"}
          </h2>

          <p>Financial Year: {ledger.financialYear}</p>

          {ledgerType === "SUPPLIER" && (
            <p>Supplier: {ledger.supplier.name}</p>
          )}

          {ledger.supplier.phone && (
            <p>Phone: {ledger.supplier.phone}</p>
          )}

          {ledger.supplier.gstNumber && (
            <p>GST: {ledger.supplier.gstNumber}</p>
          )}
        </div>

        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Date</th>
                <th>Item / Particulars</th>
                <th>Quantity / Weight</th>
                <th>Rate</th>
                <th>Purchase Amount</th>
                <th>Payment Made</th>
                <th>Balance</th>
              </tr>
            </thead>

            <tbody>
              <tr className="opening-row">
                <td>-</td>
                <td>{dateText(ledger.financialYearStart)}</td>
                <td>Opening Balance</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>{currency(ledger.openingBalance)}</td>
              </tr>

              {ledger.rows.map((row) => (
                <tr key={`${row.type}-${row.id}`}>
                  <td>{row.serialNumber}</td>
                  <td>{dateText(row.date)}</td>

                  <td>
                    {row.type === "PURCHASE" && row.items.length > 0 ? (
                      <div>
                        {row.items.map((item) => (
                          <div key={item.id} style={{ marginBottom: 5 }}>
                            {item.productName}
                          </div>
                        ))}
                        {row.invoiceNumber && (
                          <div>Invoice: {row.invoiceNumber}</div>
                        )}
                      </div>
                    ) : (
                      row.item || row.paymentNote || "-"
                    )}
                  </td>

                  <td>
                    {row.type === "PURCHASE" && row.items.length > 0 ? (
                      <div>
                        {row.items.map((item) => (
                          <div key={item.id} style={{ marginBottom: 5 }}>
                            {item.quantity != null
                              ? `${item.quantity} units`
                              : `${item.weight.toFixed(3)} kg`}
                          </div>
                        ))}
                      </div>
                    ) : row.type === "PURCHASE" ? (
                      `${(row.weight ?? 0).toFixed(3)} kg`
                    ) : (
                      "-"
                    )}
                  </td>

                  <td>
                    {row.type === "PURCHASE" && row.items.length > 0 ? (
                      <div>
                        {row.items.map((item) => (
                          <div key={item.id} style={{ marginBottom: 5 }}>
                            {currency(item.rate)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td>
                    {row.type === "PURCHASE"
                      ? currency(row.amount)
                      : "-"}
                  </td>

                  <td>
                    {row.type === "SUPPLIER_PAYMENT"
                      ? currency(row.paymentMade)
                      : "-"}
                  </td>

                  <td>{currency(row.balance)}</td>
                </tr>
              ))}

              <tr className="closing-row">
                <td colSpan={5}>Closing Balance</td>
                <td>{currency(ledger.totalPurchases)}</td>
                <td>{currency(ledger.totalPayments)}</td>
                <td>{currency(ledger.closingBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    ))}
  </>
)}
            </>
          )}
            </main>
      </div>
      );
    }
