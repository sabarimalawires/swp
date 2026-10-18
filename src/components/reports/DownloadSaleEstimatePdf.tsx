
"use client";

import { PDFDownloadLink } from "@react-pdf/renderer";
import SaleEstimatePdf, {
  type EstimateData,
} from "./SaleEstimatePdf";

type Props = {
  data: EstimateData;
};

function fileDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "estimate";

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export default function DownloadSaleEstimatePdf({ data }: Props) {
  return (
    <PDFDownloadLink
      document={<SaleEstimatePdf data={data} />}
      fileName={`Estimate-${fileDate(data.saleDate)}.pdf`}
    >
      {({ loading }) => (
        <button
          type="button"
          disabled={loading}
          className="rounded-lg border border-[#e8d4c5] bg-white px-3 py-1.5 text-xs font-semibold text-[#5b3928] hover:bg-[#fff1e6] disabled:opacity-60"
        >
          {loading ? "Preparing PDF..." : "Generate Estimate"}
        </button>
      )}
    </PDFDownloadLink>
  );
}
