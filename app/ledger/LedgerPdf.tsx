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

type CustomerLedgerRow = {
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

type CustomerLedger = {
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
  rows: CustomerLedgerRow[];
};

type SupplierLedgerItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number | null;
  weight: number;
  rate: number;
  amount: number;
};

type SupplierLedgerRow = {
  id: string;
  date: string | Date;
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
  items: SupplierLedgerItem[];
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
  financialYearStart: string | Date;
  financialYearEnd: string | Date;
  openingBalance: number;
  totalPurchases: number;
  totalPayments: number;
  closingBalance: number;
  rows: SupplierLedgerRow[];
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

type LedgerPdfProps = {
  data: LedgerPdfData;
  ledgerType: "CUSTOMER" | "SUPPLIER" | "COMBINED";
  customerId?: string;
  supplierId?: string;
};

const COMPANY = "SABARIMALA WIRE PRODUCTS";
const WEBSITE = "https://sabarimalawires.in/";
const PHONE = "+91 94424 90142";
const PHONE_LINK = "tel:+919442490142";
const LOCATION = "Tirunelveli, Tamil Nadu";
const MAP_LINK =
  "https://www.google.com/maps/search/?api=1&query=" +
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
};

const salesUnitLabels: Record<LedgerSaleItem["salesUnit"], string> = {
  KGS: "kg",
  SQ_FT: "Sq.ft",
  R_FT: "R.ft",
  R_MTR: "R.m",
};

const styles = StyleSheet.create({
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

  partyHeader: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.beigeLight,
    borderRadius: 3,
  },

  partyName: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.oliveDark,
    marginBottom: 4,
  },

  partyMeta: {
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

  serial: { width: "5%" },
  date: { width: "10%" },
  particulars: { width: "25%" },
  measurement: { width: "13%", textAlign: "right" },
  rate: { width: "12%", textAlign: "right" },
  amount: { width: "12%", textAlign: "right" },
  payment: { width: "12%", textAlign: "right" },
  balance: { width: "11%", textAlign: "right" },
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

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>{COMPANY}</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

function CustomerTable({ ledger }: { ledger: CustomerLedger }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader} fixed>
        <Text style={[styles.headerCell, styles.serial]}>S.No</Text>
        <Text style={[styles.headerCell, styles.date]}>Date</Text>
        <Text style={[styles.headerCell, styles.particulars]}>
          Item / Particulars
        </Text>
        <Text style={[styles.headerCell, styles.measurement]}>
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
        <Text style={[styles.cell, styles.measurement]}>-</Text>
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
              : row.item || row.paymentNote || "-"}
          </Text>

          <Text style={[styles.cell, styles.measurement]}>
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
        <Text style={[styles.cell, { width: "63%", fontWeight: "bold" }]}>
          TOTAL / CLOSING BALANCE
        </Text>
        <Text style={[styles.cell, { width: "12%", textAlign: "right" }]}>
          {money(ledger.totalSales)}
        </Text>
        <Text style={[styles.cell, { width: "12%", textAlign: "right" }]}>
          {money(ledger.totalPayments)}
        </Text>
        <Text style={[styles.cell, { width: "13%", textAlign: "right" }]}>
          {money(ledger.closingBalance)}
        </Text>
      </View>
    </View>
  );
}

function SupplierTable({ ledger }: { ledger: SupplierLedger }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader} fixed>
        <Text style={[styles.headerCell, styles.serial]}>S.No</Text>
        <Text style={[styles.headerCell, styles.date]}>Date</Text>
        <Text style={[styles.headerCell, styles.particulars]}>
          Item / Particulars
        </Text>
        <Text style={[styles.headerCell, styles.measurement]}>
          Quantity / Weight
        </Text>
        <Text style={[styles.headerCell, styles.rate]}>Invoice No.</Text>
        <Text style={[styles.headerCell, styles.amount]}>Purchase</Text>
        <Text style={[styles.headerCell, styles.payment]}>
          Payment Made
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
        <Text style={[styles.cell, styles.measurement]}>-</Text>
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
            {row.type === "PURCHASE" && row.items?.length
              ? row.items
                  .map((item) => `${item.productName} (${item.quantity ?? "-"})`)
                  .join("\n")
              : row.item || row.paymentNote || "-"}
          </Text>

          <Text style={[styles.cell, styles.measurement]}>
            {row.type === "PURCHASE"
              ? row.weight != null
                ? `${row.weight.toFixed(3)} kg`
                : row.quantity != null
                  ? String(row.quantity)
                  : "-"
              : "-"}
          </Text>

          <Text style={[styles.cell, styles.rate]}>
            {row.invoiceNumber || "-"}
          </Text>

          <Text style={[styles.cell, styles.amount]}>
            {row.type === "PURCHASE" ? money(row.amount) : "-"}
          </Text>

          <Text style={[styles.cell, styles.payment]}>
            {row.type === "SUPPLIER_PAYMENT"
              ? money(row.paymentMade)
              : "-"}
          </Text>

          <Text style={[styles.cell, styles.balance]}>
            {money(row.balance)}
          </Text>
        </View>
      ))}

      <View style={styles.totalRow} wrap={false}>
        <Text style={[styles.cell, { width: "63%", fontWeight: "bold" }]}>
          TOTAL / CLOSING BALANCE
        </Text>
        <Text style={[styles.cell, { width: "12%", textAlign: "right" }]}>
          {money(ledger.totalPurchases)}
        </Text>
        <Text style={[styles.cell, { width: "12%", textAlign: "right" }]}>
          {money(ledger.totalPayments)}
        </Text>
        <Text style={[styles.cell, { width: "13%", textAlign: "right" }]}>
          {money(ledger.closingBalance)}
        </Text>
      </View>
    </View>
  );
}

function CustomerLedgerPage({
  ledger,
  generatedDate,
}: {
  ledger: CustomerLedger;
  generatedDate: string;
}) {
  return (
    <Page
      key={`customer-${ledger.customer.id}`}
      size="A4"
      orientation="landscape"
      style={styles.page}
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

      <View style={styles.partyHeader}>
        <Text style={styles.partyName}>{ledger.customer.name}</Text>
        <Text style={styles.partyMeta}>
          Mobile: {ledger.customer.phone || "Not provided"}
        </Text>
      </View>

      <View style={styles.summary}>
        <SummaryItem label="Opening Balance" value={money(ledger.openingBalance)} />
        <SummaryItem label="Total Sales" value={money(ledger.totalSales)} />
        <SummaryItem label="Payments Received" value={money(ledger.totalPayments)} />
        <SummaryItem label="Closing Balance" value={money(ledger.closingBalance)} />
      </View>

      {ledger.rows.length === 0 ? (
        <View style={styles.table}>
          <Text style={styles.empty}>
            No transactions recorded for this financial year.
          </Text>
        </View>
      ) : (
        <CustomerTable ledger={ledger} />
      )}

      {ledger.openingBalanceIsManualOverride && (
        <Text style={styles.partyMeta}>
          Opening balance manually overridden by an administrator.
        </Text>
      )}

      <Footer />
    </Page>
  );
}

function SupplierLedgerPage({
  ledger,
  generatedDate,
}: {
  ledger: SupplierLedger;
  generatedDate: string;
}) {
  return (
    <Page
      key={`supplier-${ledger.supplier.id}`}
      size="A4"
      orientation="landscape"
      style={styles.page}
    >
      <Image
        src="/ledger-watermark-logo.png"
        style={styles.watermark}
        fixed
      />

      <BusinessHeader />

      <View style={styles.reportHeading}>
        <Text style={styles.title}>SUPPLIER PURCHASE LEDGER</Text>
        <Text style={styles.subtitle}>
          Financial Year: {ledger.financialYear}
        </Text>
      </View>

      <Text style={styles.generated}>
        Generated on: {generatedDate}
      </Text>

      <View style={styles.partyHeader}>
        <Text style={styles.partyName}>{ledger.supplier.name}</Text>
        <Text style={styles.partyMeta}>
          Mobile: {ledger.supplier.phone || "Not provided"}
        </Text>
        <Text style={styles.partyMeta}>
          Email: {ledger.supplier.email || "Not provided"}
        </Text>
        <Text style={styles.partyMeta}>
          GST: {ledger.supplier.gstNumber || "Not provided"}
        </Text>
      </View>

      <View style={styles.summary}>
        <SummaryItem label="Opening Balance" value={money(ledger.openingBalance)} />
        <SummaryItem label="Total Purchases" value={money(ledger.totalPurchases)} />
        <SummaryItem label="Payments Made" value={money(ledger.totalPayments)} />
        <SummaryItem label="Closing Balance" value={money(ledger.closingBalance)} />
      </View>

      {ledger.rows.length === 0 ? (
        <View style={styles.table}>
          <Text style={styles.empty}>
            No transactions recorded for this financial year.
          </Text>
        </View>
      ) : (
        <SupplierTable ledger={ledger} />
      )}

      <Footer />
    </Page>
  );
}

function CombinedSummaryPage({
  data,
  generatedDate,
}: {
  data: LedgerPdfData;
  generatedDate: string;
}) {
  return (
    <Page
      size="A4"
      orientation="landscape"
      style={styles.page}
    >
      <BusinessHeader />

      <View style={styles.reportHeading}>
        <Text style={styles.title}>COMBINED BUSINESS LEDGER</Text>
        <Text style={styles.subtitle}>
          Customer and Supplier Summary — Financial Year: {data.financialYear}
        </Text>
      </View>

      <Text style={styles.generated}>
        Generated on: {generatedDate}
      </Text>

      <Text style={{ fontSize: 11, fontWeight: "bold", marginBottom: 8 }}>
        CUSTOMER SUMMARY
      </Text>

      <View style={styles.summary}>
        <SummaryItem
          label="Customers"
          value={String(data.summary.customerCount)}
        />
        <SummaryItem
          label="Opening Balance"
          value={money(data.summary.openingBalance)}
        />
        <SummaryItem
          label="Total Sales"
          value={money(data.summary.totalSales)}
        />
        <SummaryItem
          label="Payments Received"
          value={money(data.summary.totalPayments)}
        />
      </View>

      <View style={[styles.summary, { marginBottom: 20 }]}>
        <SummaryItem
          label="Customer Closing Balance"
          value={money(data.summary.closingBalance)}
        />
        <SummaryItem
          label=" "
          value=" "
        />
        <SummaryItem
          label=" "
          value=" "
        />
        <SummaryItem
          label=" "
          value=" "
        />
      </View>

      <Text style={{ fontSize: 11, fontWeight: "bold", marginBottom: 8 }}>
        SUPPLIER SUMMARY
      </Text>

      <View style={styles.summary}>
        <SummaryItem
          label="Suppliers"
          value={String(data.supplierSummary.supplierCount)}
        />
        <SummaryItem
          label="Opening Balance"
          value={money(data.supplierSummary.openingBalance)}
        />
        <SummaryItem
          label="Total Purchases"
          value={money(data.supplierSummary.totalPurchases)}
        />
        <SummaryItem
          label="Payments Made"
          value={money(data.supplierSummary.totalPayments)}
        />
      </View>

      <View style={styles.summary}>
        <SummaryItem
          label="Supplier Closing Balance"
          value={money(data.supplierSummary.closingBalance)}
        />
        <SummaryItem label=" " value=" " />
        <SummaryItem label=" " value=" " />
        <SummaryItem label=" " value=" " />
      </View>

      <Text style={styles.empty}>
        Customer receivables and supplier payables are shown separately.
        They are not netted against each other.
      </Text>

      <Footer />
    </Page>
  );
}

export default function LedgerPdf({
  data,
  ledgerType,
  customerId,
  supplierId,
}: LedgerPdfProps) {
  const customerLedgers =
    ledgerType === "SUPPLIER"
      ? []
      : customerId
        ? data.ledgers.filter(
            (ledger) => ledger.customer.id === customerId
          )
        : data.ledgers;

  const supplierLedgers =
    ledgerType === "CUSTOMER"
      ? []
      : supplierId
        ? data.supplierLedgers.filter(
            (ledger) => ledger.supplier.id === supplierId
          )
        : data.supplierLedgers;

  const generatedDate = dateText(new Date());

  return (
    <Document
      title={`SWP ${ledgerType} Ledger ${data.financialYear}`}
      author={COMPANY}
      subject={`${ledgerType} Ledger - ${data.financialYear}`}
      creator="SWP Business Management System"
    >
      {ledgerType === "COMBINED" && (
        <CombinedSummaryPage
          data={data}
          generatedDate={generatedDate}
        />
      )}

      {customerLedgers.map((ledger) => (
        <CustomerLedgerPage
          key={ledger.customer.id}
          ledger={ledger}
          generatedDate={generatedDate}
        />
      ))}

      {supplierLedgers.map((ledger) => (
        <SupplierLedgerPage
          key={ledger.supplier.id}
          ledger={ledger}
          generatedDate={generatedDate}
        />
      ))}
    </Document>
  );
}