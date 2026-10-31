
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
      className="inline-flex min-w-[145px] items-center justify-center whitespace-nowrap rounded-lg border border-[#e8d4c5] bg-white px-3 py-1.5 text-xs font-semibold text-[#5b3928] no-underline hover:bg-[#fff1e6]"
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
