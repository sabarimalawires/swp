import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

export type ReportData = {
  report: {
    generatedAt: string;

    generatedBy: {
      name: string;
      username: string;
    };

    filters: {
      from: string | null;
      to: string | null;
      product: {
        name: string;
        code: string | null;
      } | null;
      worker: {
        name: string;
        username: string;
      } | null;
    };

    summary: {
      totalWorkEntries: number;
      approvedWorkEntries: number;
      rejectedWorkEntries: number;
      pendingWorkEntries: number;
      totalProduction: number;
      totalSalesQuantity: number;
      totalActiveSales: number;
      totalVoidedSales: number;
      lowStockProductCount: number;
    };

    inventory: {
      products: {
        id: string;
        name: string;
        code: string | null;
        stock: number;
        lowStockThreshold: number;
        isLowStock: boolean;
      }[];
    };

    workEntries: {
      id: string;
      quantity: number;
      status: string;
      submittedAt: string;

      worker: {
        name: string;
        username: string;
      };

      product: {
        name: string;
        code: string | null;
      };
    }[];

    sales: {
      id: string;
      customerName: string;
      quantity: number;
      saleDate: string;
      status: string;

      product: {
        name: string;
        code: string | null;
      };
    }[];
  };
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 45,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#3b2117",
  },

  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5cdbd",
    paddingBottom: 14,
    marginBottom: 18,
    textAlign: "center",
  },

  company: {
    fontSize: 9,
    color: "#a66a4a",
    fontWeight: "bold",
    letterSpacing: 1,
  },

  systemName: {
    marginTop: 5,
    fontSize: 16,
    fontWeight: "bold",
  },

  reportTitle: {
    marginTop: 8,
    fontSize: 13,
    color: "#d96f2b",
    fontWeight: "bold",
  },

  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 18,
  },

  infoItem: {
    width: "50%",
    marginBottom: 9,
    paddingRight: 10,
  },

  label: {
    fontSize: 7,
    color: "#a66a4a",
    fontWeight: "bold",
    textTransform: "uppercase",
  },

  value: {
    marginTop: 3,
    fontSize: 9,
  },

  section: {
    marginTop: 14,
    marginBottom: 8,
  },

  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#3b2117",
    marginBottom: 7,
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  summaryItem: {
    width: "25%",
    padding: 7,
    borderWidth: 1,
    borderColor: "#f1dfd2",
    backgroundColor: "#fffaf6",
  },

  summaryLabel: {
    fontSize: 6.5,
    color: "#a66a4a",
    fontWeight: "bold",
  },

  summaryValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "bold",
  },

  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e5cdbd",
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#fff4eb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5cdbd",
    fontWeight: "bold",
  },

  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1dfd2",
  },

  tableRowLast: {
    flexDirection: "row",
  },

  cell: {
    padding: 5,
    fontSize: 7.5,
  },

  headerCell: {
    padding: 5,
    fontSize: 7,
    fontWeight: "bold",
    color: "#6f4a38",
  },

  inventoryProduct: {
    width: "27%",
  },

  inventoryCode: {
    width: "17%",
  },

  inventoryStock: {
    width: "16%",
  },

  inventoryThreshold: {
    width: "20%",
  },

  inventoryStatus: {
    width: "20%",
  },

  workDate: {
    width: "19%",
  },

  workWorker: {
    width: "23%",
  },

  workProduct: {
    width: "25%",
  },

  workQuantity: {
    width: "15%",
  },

  workStatus: {
    width: "18%",
  },

  saleDate: {
    width: "19%",
  },

  saleCustomer: {
    width: "24%",
  },

  saleProduct: {
    width: "25%",
  },

  saleQuantity: {
    width: "14%",
  },

  saleStatus: {
    width: "18%",
  },

  lowStock: {
    color: "#b42318",
    fontWeight: "bold",
  },

  normalStock: {
    color: "#237a3b",
    fontWeight: "bold",
  },

  empty: {
    padding: 10,
    textAlign: "center",
    color: "#8b6b5a",
  },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    textAlign: "center",
    fontSize: 7,
    color: "#8b6b5a",
  },
});

function dateOnly(value: string | null) {
  if (!value) {
    return "All dates";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function dateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function status(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

export default function OverallReportPdf({
  data,
}: {
  data: ReportData;
}) {
  const report = data.report;

  return (
    <Document
      title="Overall Business Report"
      author={report.generatedBy.name}
      subject="SWP Overall Business Report"
      creator="SWP Business Management System"
    >
      <Page
        size="A4"
        style={styles.page}
        wrap
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.company}>
            SWP
          </Text>

          <Text style={styles.systemName}>
            BUSINESS MANAGEMENT SYSTEM
          </Text>

          <Text style={styles.reportTitle}>
            OVERALL BUSINESS REPORT
          </Text>
        </View>

        {/* REPORT INFORMATION */}
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.label}>
              Generated Date
            </Text>

            <Text style={styles.value}>
              {new Date(
                report.generatedAt
              ).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.label}>
              Generated Time
            </Text>

            <Text style={styles.value}>
              {new Date(
                report.generatedAt
              ).toLocaleTimeString()}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.label}>
              Generated By
            </Text>

            <Text style={styles.value}>
              {report.generatedBy.name} (
              {report.generatedBy.username})
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.label}>
              Report Period
            </Text>

            <Text style={styles.value}>
              {dateOnly(report.filters.from)}{" "}
              →{" "}
              {dateOnly(report.filters.to)}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.label}>
              Product Filter
            </Text>

            <Text style={styles.value}>
              {report.filters.product?.name ||
                "All Products"}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.label}>
              Worker Filter
            </Text>

            <Text style={styles.value}>
              {report.filters.worker?.name ||
                "All Workers"}
            </Text>
          </View>
        </View>

        {/* SUMMARY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Summary
          </Text>

          <View style={styles.summaryGrid}>
            <Summary
              label="Total Work"
              value={
                report.summary.totalWorkEntries
              }
            />

            <Summary
              label="Approved Work"
              value={
                report.summary
                  .approvedWorkEntries
              }
            />

            <Summary
              label="Rejected Work"
              value={
                report.summary
                  .rejectedWorkEntries
              }
            />

            <Summary
              label="Pending Work"
              value={
                report.summary.pendingWorkEntries
              }
            />

            <Summary
              label="Total Production"
              value={
                report.summary.totalProduction
              }
            />

            <Summary
              label="Quantity Sold"
              value={
                report.summary.totalSalesQuantity
              }
            />

            <Summary
              label="Active Sales"
              value={
                report.summary.totalActiveSales
              }
            />

            <Summary
              label="Voided Sales"
              value={
                report.summary.totalVoidedSales
              }
            />
          </View>
        </View>

        {/* INVENTORY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Inventory
          </Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text
                style={[
                  styles.headerCell,
                  styles.inventoryProduct,
                ]}
              >
                Product
              </Text>

              <Text
                style={[
                  styles.headerCell,
                  styles.inventoryCode,
                ]}
              >
                Code
              </Text>

              <Text
                style={[
                  styles.headerCell,
                  styles.inventoryStock,
                ]}
              >
                Stock
              </Text>

              <Text
                style={[
                  styles.headerCell,
                  styles.inventoryThreshold,
                ]}
              >
                Threshold
              </Text>

              <Text
                style={[
                  styles.headerCell,
                  styles.inventoryStatus,
                ]}
              >
                Status
              </Text>
            </View>

            {report.inventory.products.length ===
            0 ? (
              <Text style={styles.empty}>
                No inventory records found.
              </Text>
            ) : (
              report.inventory.products.map(
                (product, index) => (
                  <View
                    key={product.id}
                    style={
                      index ===
                      report.inventory.products
                        .length -
                        1
                        ? styles.tableRowLast
                        : styles.tableRow
                    }
                  >
                    <Text
                      style={[
                        styles.cell,
                        styles.inventoryProduct,
                      ]}
                    >
                      {product.name}
                    </Text>

                    <Text
                      style={[
                        styles.cell,
                        styles.inventoryCode,
                      ]}
                    >
                      {product.code || "—"}
                    </Text>

                    <Text
                      style={[
                        styles.cell,
                        styles.inventoryStock,
                      ]}
                    >
                      {product.stock}
                    </Text>

                    <Text
                      style={[
                        styles.cell,
                        styles.inventoryThreshold,
                      ]}
                    >
                      {product.lowStockThreshold}
                    </Text>

                    <Text
                      style={[
                        styles.cell,
                        styles.inventoryStatus,
                        product.isLowStock
                          ? styles.lowStock
                          : styles.normalStock,
                      ]}
                    >
                      {product.isLowStock
                        ? "Low Stock"
                        : "Normal"}
                    </Text>
                  </View>
                )
              )
            )}
          </View>
        </View>

        {/* WORK ENTRIES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Work Entries
          </Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text
                style={[
                  styles.headerCell,
                  styles.workDate,
                ]}
              >
                Date
              </Text>

              <Text
                style={[
                  styles.headerCell,
                  styles.workWorker,
                ]}
              >
                Worker
              </Text>

              <Text
                style={[
                  styles.headerCell,
                  styles.workProduct,
                ]}
              >
                Product
              </Text>

              <Text
                style={[
                  styles.headerCell,
                  styles.workQuantity,
                ]}
              >
                Quantity
              </Text>

              <Text
                style={[
                  styles.headerCell,
                  styles.workStatus,
                ]}
              >
                Status
              </Text>
            </View>

            {report.workEntries.length === 0 ? (
              <Text style={styles.empty}>
                No work entries found for the
                selected filters.
              </Text>
            ) : (
              report.workEntries.map(
                (entry, index) => (
                  <View
                    key={entry.id}
                    style={
                      index ===
                      report.workEntries.length -
                        1
                        ? styles.tableRowLast
                        : styles.tableRow
                    }
                  >
                    <Text
                      style={[
                        styles.cell,
                        styles.workDate,
                      ]}
                    >
                      {dateTime(
                        entry.submittedAt
                      )}
                    </Text>

                    <Text
                      style={[
                        styles.cell,
                        styles.workWorker,
                      ]}
                    >
                      {entry.worker.name}
                    </Text>

                    <Text
                      style={[
                        styles.cell,
                        styles.workProduct,
                      ]}
                    >
                      {entry.product.name}
                    </Text>

                    <Text
                      style={[
                        styles.cell,
                        styles.workQuantity,
                      ]}
                    >
                      {entry.quantity}
                    </Text>

                    <Text
                      style={[
                        styles.cell,
                        styles.workStatus,
                      ]}
                    >
                      {status(entry.status)}
                    </Text>
                  </View>
                )
              )
            )}
          </View>
        </View>

        {/* SALES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Sales
          </Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text
                style={[
                  styles.headerCell,
                  styles.saleDate,
                ]}
              >
                Date
              </Text>

              <Text
                style={[
                  styles.headerCell,
                  styles.saleCustomer,
                ]}
              >
                Customer
              </Text>

              <Text
                style={[
                  styles.headerCell,
                  styles.saleProduct,
                ]}
              >
                Product
              </Text>

              <Text
                style={[
                  styles.headerCell,
                  styles.saleQuantity,
                ]}
              >
                Quantity
              </Text>

              <Text
                style={[
                  styles.headerCell,
                  styles.saleStatus,
                ]}
              >
                Status
              </Text>
            </View>

            {report.sales.length === 0 ? (
              <Text style={styles.empty}>
                No sales found for the selected
                filters.
              </Text>
            ) : (
              report.sales.map(
                (sale, index) => (
                  <View
                    key={sale.id}
                    style={
                      index ===
                      report.sales.length - 1
                        ? styles.tableRowLast
                        : styles.tableRow
                    }
                  >
                    <Text
                      style={[
                        styles.cell,
                        styles.saleDate,
                      ]}
                    >
                      {dateTime(
                        sale.saleDate
                      )}
                    </Text>

                    <Text
                      style={[
                        styles.cell,
                        styles.saleCustomer,
                      ]}
                    >
                      {sale.customerName}
                    </Text>

                    <Text
                      style={[
                        styles.cell,
                        styles.saleProduct,
                      ]}
                    >
                      {sale.product.name}
                    </Text>

                    <Text
                      style={[
                        styles.cell,
                        styles.saleQuantity,
                      ]}
                    >
                      {sale.quantity}
                    </Text>

                    <Text
                      style={[
                        styles.cell,
                        styles.saleStatus,
                      ]}
                    >
                      {status(sale.status)}
                    </Text>
                  </View>
                )
              )
            )}
          </View>
        </View>

        {/* FOOTER */}
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `SWP Business Management System  •  Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>
        {label}
      </Text>

      <Text style={styles.summaryValue}>
        {value.toLocaleString()}
      </Text>
    </View>
  );
}
