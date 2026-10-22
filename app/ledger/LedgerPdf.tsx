
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

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
};

type Ledger = {
  customer: {
    id: string;
    name: string;
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

const colors = {
  brown: "#3b2117",
  muted: "#80523d",
  accent: "#b95720",
  border: "#e5cdbd",
  pale: "#fff4eb",
  white: "#ffffff",
  alternate: "#fffaf6",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 38,
    paddingHorizontal: 28,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: colors.brown,
  },
  header: {
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 9,
    marginBottom: 12,
  },
  company: {
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 1.5,
    color: colors.accent,
  },
  title: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "bold",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 9,
    color: colors.muted,
  },
  customerHeader: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.alternate,
  },
  customerName: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 4,
  },
  customerMeta: {
    fontSize: 8,
    color: colors.muted,
  },
  summary: {
    flexDirection: "row",
    marginBottom: 12,
  },
  summaryItem: {
    width: "25%",
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  summaryLabel: {
    fontSize: 7,
    color: colors.muted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: "bold",
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.pale,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  openingRow: {
    flexDirection: "row",
    backgroundColor: colors.pale,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cell: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 7.5,
  },
  headerCell: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 7,
    fontWeight: "bold",
  },
  serial: { width: "6%" },
  date: { width: "12%" },
  particulars: { width: "24%" },
  quantity: { width: "8%", textAlign: "right" },
  weight: { width: "10%", textAlign: "right" },
  amount: { width: "12%", textAlign: "right" },
  payment: { width: "14%", textAlign: "right" },
  balance: { width: "14%", textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    backgroundColor: colors.alternate,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  empty: {
    padding: 12,
    textAlign: "center",
    color: colors.muted,
  },
  footer: {
    position: "absolute",
    bottom: 15,
    left: 28,
    right: 28,
    textAlign: "center",
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

function LedgerTable({ ledger }: { ledger: Ledger }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader} fixed>
        <Text style={[styles.headerCell, styles.serial]}>S.No</Text>
        <Text style={[styles.headerCell, styles.date]}>Date</Text>
        <Text style={[styles.headerCell, styles.particulars]}>
          Item / Particulars
        </Text>
        <Text style={[styles.headerCell, styles.quantity]}>Qty</Text>
        <Text style={[styles.headerCell, styles.weight]}>Weight</Text>
        <Text style={[styles.headerCell, styles.amount]}>Sales</Text>
        <Text style={[styles.headerCell, styles.payment]}>Payment</Text>
        <Text style={[styles.headerCell, styles.balance]}>Balance</Text>
      </View>

      <View style={styles.openingRow} wrap={false}>
        <Text style={[styles.cell, styles.serial]}>—</Text>
        <Text style={[styles.cell, styles.date]}>
          {dateText(ledger.financialYearStart)}
        </Text>
        <Text style={[styles.cell, styles.particulars]}>
          Opening Balance
        </Text>
        <Text style={[styles.cell, styles.quantity]}>—</Text>
        <Text style={[styles.cell, styles.weight]}>—</Text>
        <Text style={[styles.cell, styles.amount]}>—</Text>
        <Text style={[styles.cell, styles.payment]}>—</Text>
        <Text style={[styles.cell, styles.balance]}>
          {money(ledger.openingBalance)}
        </Text>
      </View>

      {ledger.rows.map((row) => (
        <View
          key={`${row.type}-${row.id}`}
          style={styles.tableRow}
          wrap={false}
        >
          <Text style={[styles.cell, styles.serial]}>
            {row.serialNumber}
          </Text>
          <Text style={[styles.cell, styles.date]}>
            {dateText(row.date)}
          </Text>
          <Text style={[styles.cell, styles.particulars]}>
            {row.item}
            {row.type === "PAYMENT" &&
            row.paymentNote &&
            row.paymentNote.trim().toLowerCase() !==
              row.item.trim().toLowerCase()
              ? ` — ${row.paymentNote}`
              : ""}
          </Text>
          <Text style={[styles.cell, styles.quantity]}>
            {row.quantity ?? "—"}
          </Text>
          <Text style={[styles.cell, styles.weight]}>
            {row.weight == null ? "—" : row.weight.toFixed(3)}
          </Text>
          <Text style={[styles.cell, styles.amount]}>
            {row.type === "SALE" ? money(row.amount) : "—"}
          </Text>
          <Text style={[styles.cell, styles.payment]}>
            {row.type === "PAYMENT"
              ? money(row.paymentReceived)
              : "—"}
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
            { width: "50%", fontWeight: "bold" },
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
            { width: "24%", textAlign: "right", fontWeight: "bold" },
          ]}
        >
          {money(ledger.closingBalance)}
        </Text>
      </View>
    </View>
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

  return (
    <Document
      title={`SWP Customer Ledger ${data.financialYear}`}
      author="SWP Business Management System"
      subject={`Customer Sales Ledger - ${data.financialYear}`}
      creator="SWP Business Management System"
    >
      {combined ? (
        <>
          {ledgers.map((ledger) => (
            <Page
              key={ledger.customer.id}
              size="A4"
              orientation="landscape"
              style={styles.page}
              wrap
            >
              <View style={styles.header}>
                <Text style={styles.company}>SWP</Text>
                <Text style={styles.title}>CUSTOMER SALES LEDGER</Text>
                <Text style={styles.subtitle}>
                  Financial Year: {ledger.financialYear}
                </Text>
              </View>

              <View style={styles.customerHeader}>
                <Text style={styles.customerName}>
                  {ledger.customer.name}
                </Text>
                <Text style={styles.customerMeta}>
                  
                </Text>
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

              <LedgerTable ledger={ledger} />

              <Text
                style={styles.footer}
                fixed
                render={({ pageNumber, totalPages }) =>
                  `SWP Business Management System  •  Page ${pageNumber} of ${totalPages}`
                }
              />
            </Page>
          ))}
        </>
      ) : (
        ledgers.map((ledger) => (
          <Page
            key={ledger.customer.id}
            size="A4"
            orientation="landscape"
            style={styles.page}
            wrap
          >
            <View style={styles.header}>
              <Text style={styles.company}>SWP</Text>
              <Text style={styles.title}>CUSTOMER SALES LEDGER</Text>
              <Text style={styles.subtitle}>
                Financial Year: {ledger.financialYear}
              </Text>
            </View>

            <View style={styles.customerHeader}>
              <Text style={styles.customerName}>
                {ledger.customer.name}
              </Text>
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

            <LedgerTable ledger={ledger} />

            <Text
              style={styles.footer}
              fixed
              render={({ pageNumber, totalPages }) =>
                `SWP Business Management System  •  Page ${pageNumber} of ${totalPages}`
              }
            />
          </Page>
        ))
      )}
    </Document>
  );
}
