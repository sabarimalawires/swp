"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import OverallReportPdf from "./OverallReportPdf";

type Props = {
  data: any;
};

export default function DownloadOverallReportPdf({
  data,
}: Props) {
  return (
    <PDFDownloadLink
      document={<OverallReportPdf data={data} />}
      fileName={`SWP-Overall-Report-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`}
    >
      {({ loading }) => (
        <button
          type="button"
          disabled={loading}
          className="h-11 rounded-xl bg-[#b95720] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a94d1c] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Preparing PDF..."
            : "Export PDF"}
        </button>
      )}
    </PDFDownloadLink>
  );
}