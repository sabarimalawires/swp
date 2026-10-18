
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

export type EstimateItem = {
  productName: string;
  quantity: number;
  weight: number;
  rate: number;
  amount: number;
};

export type EstimateData = {
  customerName: string;
  customerPhone?: string | null;
  saleDate: string;
  items: EstimateItem[];
  totalAmount: number;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingHorizontal: 32,
    paddingBottom: 32,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#222222",
  },

  heading: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 24,
  },

  details: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 9,
    fontWeight: "bold",
  },

  label: {
    fontWeight: "bold",
  },

  table: {
    marginTop: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: "#555555",
  },

  row: {
    flexDirection: "row",
  },

  cell: {
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#555555",
    justifyContent: "center",
    fontWeight: "bold",
  },

  headerCell: {
    fontWeight: "bold",
    backgroundColor: "#e8e8e8",
  },

  serial: {
    width: "9%",
  },

  description: {
    width: "27%",
  },

  quantity: {
    width: "14%",
  },

  weight: {
    width: "16%",
  },

  rate: {
    width: "15%",
  },

  amount: {
    width: "19%",
    textAlign: "right",
  },

  total: {
    marginTop: 16,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "bold",
  },

  words: {
    marginTop: 18,
    lineHeight: 1.5,
    fontWeight: "bold",
  },
});

function numberToWords(value: number): string {
  const ones = [
    "Zero", "One", "Two", "Three", "Four", "Five", "Six",
    "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
    "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
    "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty",
    "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  const underThousand = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) {
      return tens[Math.floor(n / 10)] +
        (n % 10 ? " " + ones[n % 10] : "");
    }
    return ones[Math.floor(n / 100)] + " Hundred" +
      (n % 100 ? " " + underThousand(n % 100) : "");
  };

  const convert = (n: number): string => {
    if (n < 1000) return underThousand(n);
    if (n < 100000) {
      return underThousand(Math.floor(n / 1000)) +
        " Thousand" +
        (n % 1000 ? " " + convert(n % 1000) : "");
    }
    if (n < 10000000) {
      return underThousand(Math.floor(n / 100000)) +
        " Lakh" +
        (n % 100000 ? " " + convert(n % 100000) : "");
    }
    return underThousand(Math.floor(n / 10000000)) +
      " Crore" +
      (n % 10000000 ? " " + convert(n % 10000000) : "");
  };

  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  return (
    convert(rupees) +
    (paise ? " and " + convert(paise) + " Paise" : "") +
    " Only"
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { timeZone: "UTC" });
}

export default function SaleEstimatePdf({
  data,
}: {
  data: EstimateData;
}) {
  const total = Math.round(data.totalAmount * 100) / 100;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.heading}>ESTIMATE</Text>

        <View style={styles.details}>
          <Text>
            <Text style={styles.label}>Customer Name: </Text>
            {data.customerName}
          </Text>
          <Text>
            <Text style={styles.label}>Sale Date: </Text>
            {formatDate(data.saleDate)}
          </Text>
        </View>

        {data.customerPhone ? (
          <View style={styles.details}>
            <Text>
              <Text style={styles.label}>Phone: </Text>
              {data.customerPhone}
            </Text>
          </View>
        ) : null}

        <View style={styles.table}>
          
<View style={styles.row}>
  <View style={[styles.cell, styles.headerCell, styles.serial]}>
    <Text>S.No</Text>
  </View>
  <View style={[styles.cell, styles.headerCell, styles.description]}>
    <Text>Description</Text>
  </View>
  <View style={[styles.cell, styles.headerCell, styles.quantity]}>
    <Text>Quantity</Text>
  </View>
  <View style={[styles.cell, styles.headerCell, styles.weight]}>
    <Text>Weight</Text>
  </View>
  <View style={[styles.cell, styles.headerCell, styles.rate]}>
    <Text>Rate</Text>
  </View>
  <View style={[styles.cell, styles.headerCell, styles.amount]}>
    <Text>Amount</Text>
  </View>
</View>


          {data.items.map((item, index) => (
            <View
              key={`${item.productName}-${index}`}
              style={styles.row}
            >
              <View style={[styles.cell, styles.serial]}>
                <Text>{index + 1}</Text>
              </View>
              <View style={[styles.cell, styles.description]}>
                <Text>{item.productName}</Text>
              </View>
              <View style={[styles.cell, styles.quantity]}>
                <Text>{item.quantity} Nos</Text>
              </View>
              <View style={[styles.cell, styles.weight]}>
                <Text>{Number(item.weight).toFixed(2)}kg</Text>
              </View>
              <View style={[styles.cell, styles.rate]}>
                <Text>{Number(item.rate).toFixed(2)}</Text>
              </View>
              <View style={[styles.cell, styles.amount]}>
                <Text>{Number(item.amount).toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.total}>
          Total Amount: {total.toFixed(2)}
        </Text>

        <Text style={styles.words}>
          Amount in words: {numberToWords(total)}
        </Text>
      </Page>
    </Document>
  );
}
