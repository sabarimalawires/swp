
"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import LedgerPdf, { type LedgerPdfData } from "./LedgerPdf";

type Props = {
  data: LedgerPdfData;
  combined: boolean;
  financialYear: string;
  customerName?: string;
  customerId?: string;
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
  combined,
  financialYear,
  customerName,
  customerId,
}: Props) {
  const reportName = combined
    ? "All-Customers"
    : customerName || data.ledgers[0]?.customer.name || "Customer";

  const filename =
    `SWP-Ledger-${safeFilename(reportName)}-FY-` +
    `${safeFilename(financialYear)}.pdf`;

  return (
    <PDFDownloadLink
      document={
  <LedgerPdf
    data={data}
    combined={combined}
    customerId={customerId}
  />
}
      fileName={filename}
      style={{ textDecoration: "none" }}
    >
      {({ loading, error }) => (
        <button
          type="button"
          disabled={loading || !data.ledgers.length}
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
