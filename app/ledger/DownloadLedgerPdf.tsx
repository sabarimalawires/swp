"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import LedgerPdf, { type LedgerPdfData } from "./LedgerPdf";

type LedgerType = "CUSTOMER" | "SUPPLIER" | "COMBINED";

type Props = {
  data: LedgerPdfData;
  ledgerType: LedgerType;
  financialYear: string;
  customerId?: string;
  supplierId?: string;
  customerName?: string;
  supplierName?: string;
};

function safeFilename(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function DownloadLedgerPdf({
  data,
  ledgerType,
  financialYear,
  customerId,
  supplierId,
  customerName,
  supplierName,
}: Props) {
  const isCustomer = ledgerType === "CUSTOMER";
  const isSupplier = ledgerType === "SUPPLIER";

  const reportName = isCustomer
    ? customerName || "All-Customers"
    : isSupplier
      ? supplierName || "All-Suppliers"
      : "Combined-Business";

  const filename =
    `SWP-${ledgerType === "CUSTOMER"
      ? "Customer"
      : ledgerType === "SUPPLIER"
        ? "Supplier"
        : "Combined"
    }-Ledger-${safeFilename(reportName)}-FY-${safeFilename(financialYear)}.pdf`;

  const hasData = isCustomer
    ? data.ledgers.length > 0
    : isSupplier
      ? (data.supplierLedgers?.length ?? 0) > 0
      : data.ledgers.length > 0 ||
        (data.supplierLedgers?.length ?? 0) > 0;

  return (
    <PDFDownloadLink
      document={
        <LedgerPdf
          data={data}
          ledgerType={ledgerType}
          customerId={customerId}
          supplierId={supplierId}
        />
      }
      fileName={filename}
      style={{ textDecoration: "none" }}
    >
      {({ loading, error }) => (
        <button
          type="button"
          disabled={loading || !hasData}
          className="ledger-button"
          title={error ? "PDF generation failed" : undefined}
        >
          {loading
            ? "Preparing PDF..."
            : error
              ? "PDF failed — try again"
              : "Download Ledger PDF"}
        </button>
      )}
    </PDFDownloadLink>
  );
}