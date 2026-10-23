
"use client";

import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/src/components/Sidebar";
import DownloadLedgerPdf from "./DownloadLedgerPdf";



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
};

type CustomerLedger = {
  customer: { id: string; name: string };
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

type LedgerResponse = {
  financialYear: string;
  summary: {
    customerCount: number;
    openingBalance: number;
    totalSales: number;
    totalPayments: number;
    closingBalance: number;
  };
  ledgers: CustomerLedger[];
};

const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

const dateText = (value: string) =>
  new Date(value).toLocaleDateString("en-IN");

export default function LedgerPage() {
  const currentYear = new Date().getFullYear();
  const defaultYear =
    new Date().getMonth() < 3 ? currentYear - 1 : currentYear;

  const [year, setYear] = useState(defaultYear);
  const [selectedCustomer, setSelectedCustomer] = useState("ALL");
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingBalanceInput, setOpeningBalanceInput] = useState("0");
  const [overrideReason, setOverrideReason] = useState("");
  const [savingOpening, setSavingOpening] = useState(false);
  const [openingMessage, setOpeningMessage] = useState("");

  useEffect(() => {
  setOpeningBalanceInput("");
  setOverrideReason("");
  setOpeningMessage("");
}, [selectedCustomer, year]);

 
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


  const combined = selectedCustomer === "ALL";

 return (
  
<div className="flex min-h-screen bg-[#fffaf5]">
  <div className="no-print">
    <Sidebar />
  </div>
  <main className="ledger-page min-w-0 flex-1">

    <style jsx global>{`
  .ledger-page {
    width: 100%;
max-width: none;
margin: 0;
box-sizing: border-box;
    padding: 28px;
    color: #3b2117;
    background: #fffaf5;
    min-height: 100vh;
  }

  .ledger-page header {
    margin-bottom: 24px;
  }

  .ledger-page header h1 {
    color: #3b2117;
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
    color: #5b2f1f;
  }

  .ledger-field select,
  .ledger-page input {
    min-height: 42px;
    border: 1px solid #e8cbbb;
    border-radius: 10px;
    padding: 10px 12px;
    background: white;
    color: #3b2117;
    font: inherit;
  }

  .ledger-page button {
    border: 1px solid #d96f2b;
    background: #d96f2b;
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
    border: 1px solid #f1dfd2;
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 16px #5b2f1f08;
  }

  .ledger-stat {
    padding: 20px;
    min-width: 0;
  }

  .ledger-stat span {
    display: block;
    color: #a66a4a;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 10px;
  }

  .ledger-stat strong {
    color: #3b2117;
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
    color: #3b2117;
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
    border: 1px solid #f1dfd2;
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
    border: 1px solid #f1dfd2;
    padding: 10px 8px;
    text-align: right;
    white-space: nowrap;
  }

  .ledger-table th {
    background: #fff1e6;
    color: #5b2f1f;
    font-weight: 700;
  }

  .ledger-table th:nth-child(3),
  .ledger-table td:nth-child(3) {
    text-align: left;
    white-space: normal;
    min-width: 150px;
  }

  .ledger-table tbody tr:nth-child(even) {
    background: #fffaf5;
  }

  .ledger-table .opening-row td,
  .ledger-table .closing-row td {
    font-weight: 700;
    background: #fff1e6;
    color: #5b2f1f;
  }

  .ledger-muted {
    color: #a66a4a;
    font-size: 13px;
  }

  .opening-balance-panel {
    margin: 24px 0;
    padding: 22px;
  }

  .opening-balance-panel h2 {
    margin: 0 0 8px;
    color: #3b2117;
    font-size: 18px;
  }

  @media (max-width: 900px) {
    .ledger-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 600px) {
    .ledger-page {
      padding: 16px;
    }

    .ledger-stat,
    .ledger-card,
    .opening-balance-panel {
      padding: 14px;
    }

    .ledger-stat strong {
      font-size: 16px;
    }

    .ledger-field {
      width: 100%;
    }
  }

`}</style>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>
          Yearly Sales Ledger
        </h1>
        <p className="ledger-muted">
          Customer accounts and combined business report
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
          <label htmlFor="ledger-customer">Ledger view</label>
          <select
            id="ledger-customer"
            value={selectedCustomer}
            onChange={(event) => setSelectedCustomer(event.target.value)}
          >
            <option value="ALL">Combined business report</option>
            {(data?.ledgers ?? []).map((ledger) => (
              <option key={ledger.customer.id} value={ledger.customer.id}>
                {ledger.customer.name}
              </option>
            ))}
          </select>
        </div>

        {data && !loading && !error && (
  <DownloadLedgerPdf
    data={data}
    combined={combined}
    financialYear={`${year}-${String(year + 1).slice(-2)}`}
    customerName={
      combined
        ? undefined
        : visibleLedgers[0]?.customer.name
    }
      customerId={combined ? undefined : selectedCustomer}
  />
)}

        <button
          type="button"
          className="ledger-button"
          onClick={() => void loadLedger()}
        >
          Refresh
        </button>
      </section>

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
          <section className="ledger-summary">
            <div className="ledger-stat">
              <span>Opening balance</span>
              <strong>
                {currency(
                  combined
                    ? data.summary.openingBalance
                    : visibleLedgers[0]?.openingBalance ?? 0
                )}
              </strong>
            </div>
            <div className="ledger-stat">
              <span>Total sales</span>
              <strong>
                {currency(
                  combined
                    ? data.summary.totalSales
                    : visibleLedgers[0]?.totalSales ?? 0
                )}
              </strong>
            </div>
            <div className="ledger-stat">
              <span>Payments received</span>
              <strong>
                {currency(
                  combined
                    ? data.summary.totalPayments
                    : visibleLedgers[0]?.totalPayments ?? 0
                )}
              </strong>
            </div>
            <div className="ledger-stat">
              <span>Closing balance</span>
              <strong>
                {currency(
                  combined
                    ? data.summary.closingBalance
                    : visibleLedgers[0]?.closingBalance ?? 0
                )}
              </strong>
            </div>
          </section>

          {visibleLedgers.length === 0 && (
            <p>No customer ledgers found for this financial year.</p>
          )}

          {visibleLedgers.map((ledger) => (
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
                      <th>Qty</th>
                      <th>Weight</th>
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
  {row.item}
  {row.type === "PAYMENT" &&
  row.paymentNote &&
  row.paymentNote.trim().toLowerCase() !==
    row.item.trim().toLowerCase()
    ? ` - ${row.paymentNote}`
    : ""}
</td>
                        <td>{row.quantity ?? "-"}</td>
                        <td>
                          {row.weight === null
                            ? "-"
                            : row.weight.toFixed(3)}
                        </td>
                        <td>
                          {row.type === "SALE"
                            ? currency(row.amount)
                            : "-"}
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
        </>
      )}
        </main>
  </div>
  );
}

