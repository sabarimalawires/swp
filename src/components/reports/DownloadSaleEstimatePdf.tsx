
"use client";

import { memo } from "react";
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

function DownloadSaleEstimatePdf({ data }: Props) {
  return (
    <PDFDownloadLink
      document={<SaleEstimatePdf data={data} />}
      fileName={`Estimate-${fileDate(data.saleDate)}.pdf`}
      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-[#e8d4c5] bg-white px-3 py-2 text-[11px] font-semibold text-[#c85f22] shadow-sm transition hover:border-[#d96f2b] hover:bg-[#fffaf6] hover:text-[#b9531d] sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs"
    >
      Generate Estimate
    </PDFDownloadLink>
  );
}

function areEstimatePropsEqual(
  previous: Props,
  next: Props
): boolean {
  const a = previous.data;
  const b = next.data;

  if (
    a.customerName !== b.customerName ||
    a.customerPhone !== b.customerPhone ||
    a.saleDate !== b.saleDate ||
    a.totalAmount !== b.totalAmount ||
    a.items.length !== b.items.length
  ) {
    return false;
  }

  return a.items.every((item, index) => {
    const other = b.items[index];

    return (
      item.productName === other.productName &&
      item.quantity === other.quantity &&
      item.salesMeasurement === other.salesMeasurement &&
      item.salesUnit === other.salesUnit &&
      item.rate === other.rate &&
      item.amount === other.amount
    );
  });
}

export default memo(
  DownloadSaleEstimatePdf,
  areEstimatePropsEqual
);
