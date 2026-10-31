
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  StyleSheet,
} from "@react-pdf/renderer";

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
  date: string | Date;
  type: "SALE" | "PAYMENT";
  item: string;
  quantity: number | null;
  weight: number | null;
  amount: number;
  paymentReceived: number;
  balance: number;
  serialNumber: number;
  paymentNote?: string | null;
  items?: LedgerSaleItem[];
};

type Ledger = {
  customer: {
    id: string;
    name: string;
    phone?: string | null;
  };
  financialYear: string;
  financialYearStart: string | Date;
  financialYearEnd: string | Date;
  openingBalance: number;
  totalSales: number;
  totalPayments: number;
  closingBalance: number;
  openingBalanceIsManualOverride?: boolean;
  rows: LedgerRow[];
};

export type LedgerPdfData = {
  financialYear: string;
  summary: {
    customerCount: number;
    openingBalance: number;
    totalSales: number;
    totalPayments: number;
    closingBalance: number;
  };
  ledgers: Ledger[];
};

type LedgerPdfProps = {
  data: LedgerPdfData;
  combined: boolean;
  customerId?: string;
};

const COMPANY = "SABARIMALA WIRE PRODUCTS";
const WEBSITE = "https://sabarimalawires.in/";
const PHONE = "+91 94424 90142";
const PHONE_LINK = "tel:+919442490142";
const LOCATION = "Tirunelveli, Tamil Nadu";
const MAP_LINK =
  "https://maps.app.goo.gl/Nts1UHuD7wEZ4njSA?g_st=awb" +
  encodeURIComponent("Tirunelveli, Tamil Nadu, India");

const colors = {
  olive: "#596B35",
  oliveDark: "#394724",
  oliveLight: "#E8EDDD",
  beige: "#F4EBDD",
  beigeLight: "#FBF8F1",
  border: "#D8D0BD",
  text: "#33372B",
  muted: "#727365",
  white: "#FFFFFF",
  watermark: "#F0F0E9",
};
const salesUnitLabels: Record<LedgerSaleItem["salesUnit"], string> = {
  KGS: "kg",
  SQ_FT: "Sq.ft",
  R_FT: "R.ft",
  R_MTR: "R.m",
};
const styles = StyleSheet.create({
      serial: { width: "5%" },
  date: { width: "9%" },
  particulars: { width: "20%" },
  salesMeasurement: { width: "14%", textAlign: "right" },
  rate: { width: "12%", textAlign: "right" },
  amount: { width: "12%", textAlign: "right" },
  payment: { width: "14%", textAlign: "right" },
  balance: { width: "14%", textAlign: "right" },
  page: {
    paddingTop: 22,
    paddingBottom: 36,
    paddingHorizontal: 28,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: colors.text,
    backgroundColor: colors.white,
  },

  watermark: {
    position: "absolute",
    width: 260,
    height: 190,
    objectFit: "contain",
    left: "50%",
    top: "50%",
    marginLeft: -130,
    marginTop: -95,
    opacity: 0.09,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.olive,
  },

  logoArea: {
    width: "35%",
    justifyContent: "center",
    alignItems: "flex-start",
  },

  headerLogo: {
    width: 230,
    height: 100,
    objectFit: "contain",
  },

  companyArea: {
    width: "63%",
    alignItems: "flex-end",
    justifyContent: "center",
  },

  company: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.oliveDark,
    textAlign: "right",
  },

  tagline: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 3,
    textAlign: "right",
  },

  contactLine: {
    fontSize: 8,
    marginTop: 4,
    textAlign: "right",
    color: colors.text,
  },

  link: {
    color: colors.oliveDark,
    textDecoration: "underline",
  },

  reportHeading: {
    backgroundColor: colors.olive,
    color: colors.white,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderRadius: 3,
  },

  title: {
    fontSize: 13,
    fontWeight: "bold",
    color: colors.white,
  },

  subtitle: {
    fontSize: 8,
    color: colors.white,
    marginTop: 3,
  },

  generated: {
    fontSize: 7,
    color: colors.muted,
    textAlign: "right",
    marginBottom: 8,
  },

  customerHeader: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.beigeLight,
    borderRadius: 3,
  },

  customerName: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.oliveDark,
    marginBottom: 4,
  },

  customerMeta: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 2,
  },

  summary: {
    flexDirection: "row",
    marginBottom: 12,
  },

  summaryItem: {
    width: "25%",
    paddingVertical: 8,
    paddingHorizontal: 7,
    borderWidth: 0.7,
    borderColor: colors.border,
    backgroundColor: colors.beigeLight,
  },

  summaryLabel: {
    fontSize: 7,
    color: colors.muted,
    marginBottom: 5,
  },

  summaryValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: colors.oliveDark,
  },

  table: {
    width: "100%",
    borderWidth: 0.7,
    borderColor: colors.border,
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.olive,
    borderBottomWidth: 1,
    borderBottomColor: colors.oliveDark,
  },

  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },

  openingRow: {
    flexDirection: "row",
    backgroundColor: colors.beige,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  cell: {
    paddingVertical: 5,
    paddingHorizontal: 3,
    fontSize: 7,
    color: colors.text,
  },

  headerCell: {
    paddingVertical: 7,
    paddingHorizontal: 3,
    fontSize: 7,
    fontWeight: "bold",
    color: colors.white,
  },

  totalRow: {
    flexDirection: "row",
    backgroundColor: colors.oliveLight,
    borderTopWidth: 1,
    borderTopColor: colors.olive,
  },

  empty: {
    padding: 12,
    textAlign: "center",
    color: colors.muted,
  },

  footer: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    paddingTop: 5,
    borderTopWidth: 0.7,
    borderTopColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: colors.muted,
  },
});

function money(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateText(value: string | Date) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function BusinessHeader() {
  return (
    <View style={styles.header} fixed>
      <View style={styles.logoArea}>
        <Image
          src="/ledger-header-logo.png"
          style={styles.headerLogo}
        />
      </View>

      <View style={styles.companyArea}>
        <Text style={styles.company}>{COMPANY}</Text>
        
        <Text style={styles.contactLine}>
          Location:{" "}
          <Link src={MAP_LINK} style={styles.link}>
            {LOCATION}
          </Link>
        </Text>

        <Text style={styles.contactLine}>
          Call:{" "}
          <Link src={PHONE_LINK} style={styles.link}>
            {PHONE}
          </Link>
        </Text>

        <Text style={styles.contactLine}>
          Website:{" "}
          <Link src={WEBSITE} style={styles.link}>
            sabarimalawires.in
          </Link>
        </Text>
      </View>
    </View>
  );
}
function LedgerTable({ ledger }: { ledger: Ledger }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader} fixed>
        <Text style={[styles.headerCell, styles.serial]}>S.No</Text>
        <Text style={[styles.headerCell, styles.date]}>Date</Text>
        <Text style={[styles.headerCell, styles.particulars]}>
          Item / Particulars
        </Text>
        <Text style={[styles.headerCell, styles.salesMeasurement]}>
          Sales Quantity
        </Text>
        <Text style={[styles.headerCell, styles.rate]}>Rate / Unit</Text>
        <Text style={[styles.headerCell, styles.amount]}>Sales Amount</Text>
        <Text style={[styles.headerCell, styles.payment]}>
          Payment Received
        </Text>
        <Text style={[styles.headerCell, styles.balance]}>Balance</Text>
      </View>

      <View style={styles.openingRow} wrap={false}>
        <Text style={[styles.cell, styles.serial]}>-</Text>
        <Text style={[styles.cell, styles.date]}>
          {dateText(ledger.financialYearStart)}
        </Text>
        <Text style={[styles.cell, styles.particulars]}>
          Opening Balance
        </Text>
        <Text style={[styles.cell, styles.salesMeasurement]}>-</Text>
        <Text style={[styles.cell, styles.rate]}>-</Text>
        <Text style={[styles.cell, styles.amount]}>-</Text>
        <Text style={[styles.cell, styles.payment]}>-</Text>
        <Text style={[styles.cell, styles.balance]}>
          {money(ledger.openingBalance)}
        </Text>
      </View>

      {ledger.rows.map((row, index) => (
        <View
          key={`${row.type}-${row.id}`}
          style={[
            styles.tableRow,
            ...(index % 2 === 1
              ? [{ backgroundColor: colors.beigeLight }]
              : []),
          ]}
          wrap={false}
        >
          <Text style={[styles.cell, styles.serial]}>
            {row.serialNumber}
          </Text>

          <Text style={[styles.cell, styles.date]}>
            {dateText(row.date)}
          </Text>

          <Text style={[styles.cell, styles.particulars]}>
            {row.type === "SALE" && row.items?.length
              ? row.items
                  .map((item) => `${item.productName} (${item.quantity})`)
                  .join("\n")
              : row.item}
            {row.type === "PAYMENT" &&
            row.paymentNote &&
            row.paymentNote.trim().toLowerCase() !==
              row.item.trim().toLowerCase()
              ? ` - ${row.paymentNote}`
              : ""}
          </Text>

          <Text style={[styles.cell, styles.salesMeasurement]}>
            {row.type === "SALE" && row.items?.length
              ? row.items
                  .map(
                    (item) =>
                      `${Number(item.salesMeasurement).toFixed(3)} ${salesUnitLabels[item.salesUnit]}`
                  )
                  .join("\n")
              : row.type === "SALE" && row.weight != null
                ? `${row.weight.toFixed(3)} kg`
                : "-"}
          </Text>

          <Text style={[styles.cell, styles.rate]}>
            {row.type === "SALE" && row.items?.length
              ? row.items
                  .map(
                    (item) =>
                      `${Number(item.rate).toFixed(2)} / ${salesUnitLabels[item.salesUnit]}`
                  )
                  .join("\n")
              : "-"}
          </Text>

          <Text style={[styles.cell, styles.amount]}>
            {row.type === "SALE" ? money(row.amount) : "-"}
          </Text>

          <Text style={[styles.cell, styles.payment]}>
            {row.type === "PAYMENT"
              ? money(row.paymentReceived)
              : "-"}
          </Text>

          <Text style={[styles.cell, styles.balance]}>
            {money(row.balance)}
          </Text>
        </View>
      ))}

      <View style={styles.totalRow} wrap={false}>
        <Text
          style={[
            styles.cell,
            { width: "60%", fontWeight: "bold" },
          ]}
        >
          TOTAL / CLOSING BALANCE
        </Text>

        <Text
          style={[
            styles.cell,
            { width: "12%", textAlign: "right", fontWeight: "bold" },
          ]}
        >
          {money(ledger.totalSales)}
        </Text>

        <Text
          style={[
            styles.cell,
            { width: "14%", textAlign: "right", fontWeight: "bold" },
          ]}
        >
          {money(ledger.totalPayments)}
        </Text>

        <Text
          style={[
            styles.cell,
            { width: "14%", textAlign: "right", fontWeight: "bold" },
          ]}
        >
          {money(ledger.closingBalance)}
        </Text>
      </View>
    </View>
  );
}

function LedgerPage({
  ledger,
  combined,
  generatedDate,
}: {
  ledger: Ledger;
  combined: boolean;
  generatedDate: string;
}) {
  return (
    <Page
      key={ledger.customer.id}
      size="A4"
      orientation="landscape"
      style={styles.page}
      wrap
    >
      <Image
        src="/ledger-watermark-logo.png"
        style={styles.watermark}
        fixed
      />

      <BusinessHeader />

      <View style={styles.reportHeading}>
        <Text style={styles.title}>CUSTOMER SALES LEDGER</Text>
        <Text style={styles.subtitle}>
          Financial Year: {ledger.financialYear}
        </Text>
      </View>

      <Text style={styles.generated}>
        Generated on: {generatedDate}
      </Text>

      <View style={styles.customerHeader}>
        <Text style={styles.customerName}>
          {ledger.customer.name}
        </Text>

        {!combined && (
          <Text style={styles.customerMeta}>
            Mobile: {ledger.customer.phone || "Not provided"}
          </Text>
        )}
      </View>

      <View style={styles.summary}>
        <SummaryItem
          label="Opening Balance"
          value={money(ledger.openingBalance)}
        />
        <SummaryItem
          label="Total Sales"
          value={money(ledger.totalSales)}
        />
        <SummaryItem
          label="Payments Received"
          value={money(ledger.totalPayments)}
        />
        <SummaryItem
          label="Closing Balance"
          value={money(ledger.closingBalance)}
        />
      </View>

      {ledger.rows.length === 0 ? (
        <View style={styles.table}>
          <Text style={styles.empty}>
            No transactions recorded for this financial year.
          </Text>
        </View>
      ) : (
        <LedgerTable ledger={ledger} />
      )}

      <View style={styles.footer} fixed>
        <Text>{COMPANY}</Text>
        <Text
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
        />
      </View>
    </Page>
  );
}

export default function LedgerPdf({
  data,
  combined,
  customerId,
}: LedgerPdfProps) {
  const ledgers = combined
    ? data.ledgers
    : data.ledgers.filter(
        (ledger) => ledger.customer.id === customerId
      );

  const generatedDate = dateText(new Date());

  return (
    <Document
      title={`SWP Customer Ledger ${data.financialYear}`}
      author={COMPANY}
      subject={`Customer Sales Ledger - ${data.financialYear}`}
      creator="SWP Business Management System"
    >
      {ledgers.map((ledger) => (
        <LedgerPage
          key={ledger.customer.id}
          ledger={ledger}
          combined={combined}
          generatedDate={generatedDate}
        />
      ))}
    </Document>
  );
}
