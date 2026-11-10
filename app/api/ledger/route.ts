
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { getCustomerLedgerBalance } from "@/src/lib/ledger-balance";

function getFinancialYear(year: number) {
  return {
    start: new Date(Date.UTC(year, 3, 1)),
    end: new Date(Date.UTC(year + 1, 3, 1)),
  };
}

function money(value: unknown): number {
  return Number(value ?? 0);
}

function round(value: number) {
  return Number(value.toFixed(2));
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const yearValue = searchParams.get("year");
    const customerId = searchParams.get("customerId");
    const supplierId = searchParams.get("supplierId");

    const year = yearValue
      ? Number(yearValue)
      : new Date().getFullYear() -
        (new Date().getMonth() < 3 ? 1 : 0);

    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2200
    ) {
      return NextResponse.json(
        { error: "Invalid financial year start." },
        { status: 400 }
      );
    }

    const { start, end } = getFinancialYear(year);

    // =====================================================
    // CUSTOMER LEDGERS
    // =====================================================

    const customers = await prisma.customer.findMany({
      where: customerId ? { id: customerId } : undefined,
      select: {
        id: true,
        name: true,
        phone: true,
        whatsappDueRemindersOptIn: true,
      },
      orderBy: { name: "asc" },
    });

    if (customerId && customers.length === 0) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }

    const ledgers = await Promise.all(
      customers.map(async (customer) => {
        const ledgerBalance = await getCustomerLedgerBalance(
          customer.id,
          year
        );

        const openingBalance = ledgerBalance.openingBalance;

        const [sales, payments] = await Promise.all([
          prisma.sale.findMany({
            where: {
              customerId: customer.id,
              status: "ACTIVE",
              saleDate: { gte: start, lt: end },
            },
            include: {
              product: {
                select: { name: true, code: true },
              },
              items: {
                select: {
                  id: true,
                  productId: true,
                  productName: true,
                  quantity: true,
                  salesMeasurement: true,
                  salesUnit: true,
                  rate: true,
                  amount: true,
                  weight: true,
                  deductedWeight: true,
                },
                orderBy: { productName: "asc" },
              },
            },
            orderBy: { saleDate: "asc" },
          }),

          prisma.customerPayment.findMany({
            where: {
              customerId: customer.id,
              paymentDate: { gte: start, lt: end },
            },
            orderBy: { paymentDate: "asc" },
          }),
        ]);

        const entries = [
          ...sales.map((sale) => ({
            id: sale.id,
            date: sale.saleDate,
            type: "SALE" as const,
            item: sale.product.name,
            quantity: sale.quantity,
            weight: money(sale.weight),
            items: sale.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              salesMeasurement: money(
                item.salesMeasurement ?? item.weight
              ),
              salesUnit: item.salesUnit ?? "KGS",
              rate: money(item.rate),
              amount: money(item.amount),
              inventoryDeductionKg: money(
                item.deductedWeight ?? item.weight
              ),
            })),
            amount: money(sale.amount),
            paymentReceived: 0,
            paymentNote: null as string | null,
          })),

          ...payments.map((payment) => ({
            id: payment.id,
            date: payment.paymentDate,
            type: "PAYMENT" as const,
            item: payment.note ?? "Payment received",
            quantity: null,
            weight: null,
            amount: 0,
            paymentReceived: money(payment.amount),
            paymentNote: payment.note,
          })),
        ].sort(
          (a, b) =>
            new Date(a.date).getTime() -
              new Date(b.date).getTime() ||
            a.id.localeCompare(b.id)
        );

        let balance = openingBalance;

        const rows = entries.map((entry, index) => {
          balance += entry.amount - entry.paymentReceived;

          return {
            ...entry,
            serialNumber: index + 1,
            balance: round(balance),
          };
        });

        const totalSales = sales.reduce(
          (sum, sale) => sum + money(sale.amount),
          0
        );

        const totalPayments = payments.reduce(
          (sum, payment) => sum + money(payment.amount),
          0
        );

        return {
          customer,
          financialYear: `${year}-${String(year + 1).slice(-2)}`,
          financialYearStart: start,
          financialYearEnd: new Date(year + 1, 2, 31),
          openingBalance,
          totalSales: round(totalSales),
          totalPayments: round(totalPayments),
          closingBalance: round(
            openingBalance + totalSales - totalPayments
          ),
          openingBalanceIsManualOverride:
            ledgerBalance.openingBalanceIsManualOverride,
          rows,
        };
      })
    );

    // =====================================================
    // SUPPLIER LEDGERS
    // =====================================================

    const suppliers = await prisma.supplier.findMany({
      where: supplierId ? { id: supplierId } : undefined,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        gstNumber: true,
      },
      orderBy: { name: "asc" },
    });

    if (supplierId && suppliers.length === 0) {
      return NextResponse.json(
        { error: "Supplier not found." },
        { status: 404 }
      );
    }

    const supplierLedgers = await Promise.all(
      suppliers.map(async (supplier) => {
        const [
  previousPurchases,
  previousPayments,
  purchases,
  payments,
  manualOpeningBalance,
] = await Promise.all([
  prisma.purchase.findMany({
    where: {
      supplierId: supplier.id,
      status: "ACTIVE",
      purchaseDate: { lt: start },
    },
    select: { totalAmount: true },
  }),

  prisma.supplierPayment.findMany({
    where: {
      supplierId: supplier.id,
      paymentDate: { lt: start },
    },
    select: { amount: true },
  }),

  prisma.purchase.findMany({
    where: {
      supplierId: supplier.id,
      status: "ACTIVE",
      purchaseDate: { gte: start, lt: end },
    },
    include: {
      items: {
        include: {
          product: {
            select: { name: true, code: true },
          },
        },
      },
    },
    orderBy: { purchaseDate: "asc" },
  }),

  prisma.supplierPayment.findMany({
    where: {
      supplierId: supplier.id,
      paymentDate: { gte: start, lt: end },
    },
    orderBy: { paymentDate: "asc" },
  }),

  prisma.supplierLedgerOpeningBalance.findUnique({
    where: {
      supplierId_financialYearStart: {
        supplierId: supplier.id,
        financialYearStart: start,
      },
    },
  }),
]);

        const previousPurchaseTotal = previousPurchases.reduce(
          (sum, purchase) => sum + money(purchase.totalAmount),
          0
        );

        const previousPaymentTotal = previousPayments.reduce(
          (sum, payment) => sum + money(payment.amount),
          0
        );

        // Positive = payable to supplier.
// Negative = advance/credit with supplier.
// A manual override takes priority over the automatic carry-forward.
const automaticOpeningBalance = round(
  previousPurchaseTotal - previousPaymentTotal
);

const openingBalance = round(
  manualOpeningBalance
    ? money(manualOpeningBalance.openingBalance)
    : automaticOpeningBalance
);

const openingBalanceIsManualOverride =
  manualOpeningBalance?.isManualOverride ?? false;

        const entries = [
          ...purchases.map((purchase) => ({
            id: purchase.id,
            date: purchase.purchaseDate,
            type: "PURCHASE" as const,
            item: purchase.invoiceNumber
              ? `Purchase - Invoice ${purchase.invoiceNumber}`
              : "Purchase",
            invoiceNumber: purchase.invoiceNumber,
            quantity: purchase.items.reduce(
              (sum, item) => sum + Number(item.quantity ?? 0),
              0
            ),
            weight: purchase.items.reduce(
              (sum, item) => sum + money(item.weight),
              0
            ),
            items: purchase.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              productName: item.product.name,
              quantity: item.quantity,
              weight: money(item.weight),
              rate: money(item.rate),
              amount: money(item.amount),
            })),
            amount: money(purchase.totalAmount),
            paymentMade: 0,
            paymentNote: null as string | null,
          })),

          ...payments.map((payment) => ({
            id: payment.id,
            date: payment.paymentDate,
            type: "SUPPLIER_PAYMENT" as const,
            item: payment.note ?? "Payment made",
            invoiceNumber: null,
            quantity: null,
            weight: null,
            items: [],
            amount: 0,
            paymentMade: money(payment.amount),
            paymentNote: payment.note,
          })),
        ].sort(
          (a, b) =>
            new Date(a.date).getTime() -
              new Date(b.date).getTime() ||
            a.id.localeCompare(b.id)
        );

        let balance = openingBalance;

        const rows = entries.map((entry, index) => {
          balance += entry.amount - entry.paymentMade;

          return {
            ...entry,
            serialNumber: index + 1,
            balance: round(balance),
          };
        });

        const totalPurchases = purchases.reduce(
          (sum, purchase) => sum + money(purchase.totalAmount),
          0
        );

        const totalPayments = payments.reduce(
          (sum, payment) => sum + money(payment.amount),
          0
        );

        return {
          supplier,
          financialYear: `${year}-${String(year + 1).slice(-2)}`,
          financialYearStart: start,
          financialYearEnd: new Date(year + 1, 2, 31),
          openingBalance,
openingBalanceIsManualOverride,
totalPurchases: round(totalPurchases),
          totalPayments: round(totalPayments),
          closingBalance: round(
            openingBalance + totalPurchases - totalPayments
          ),
          rows,
        };
      })
    );

    // =====================================================
    // COMBINED SUMMARY
    // =====================================================

    const customerSummary = {
      customerCount: ledgers.length,
      openingBalance: round(
        ledgers.reduce(
          (sum, ledger) => sum + ledger.openingBalance,
          0
        )
      ),
      totalSales: round(
        ledgers.reduce(
          (sum, ledger) => sum + ledger.totalSales,
          0
        )
      ),
      totalPayments: round(
        ledgers.reduce(
          (sum, ledger) => sum + ledger.totalPayments,
          0
        )
      ),
      closingBalance: round(
        ledgers.reduce(
          (sum, ledger) => sum + ledger.closingBalance,
          0
        )
      ),
    };

    const supplierSummary = {
      supplierCount: supplierLedgers.length,
      openingBalance: round(
        supplierLedgers.reduce(
          (sum, ledger) => sum + ledger.openingBalance,
          0
        )
      ),
      totalPurchases: round(
        supplierLedgers.reduce(
          (sum, ledger) => sum + ledger.totalPurchases,
          0
        )
      ),
      totalPayments: round(
        supplierLedgers.reduce(
          (sum, ledger) => sum + ledger.totalPayments,
          0
        )
      ),
      closingBalance: round(
        supplierLedgers.reduce(
          (sum, ledger) => sum + ledger.closingBalance,
          0
        )
      ),
    };

    return NextResponse.json({
      financialYear: `${year}-${String(year + 1).slice(-2)}`,

      // Kept for existing customer-ledger compatibility.
      summary: customerSummary,

      // New supplier summary.
      supplierSummary,

      // Customer and supplier data are separate.
      ledgers,
      supplierLedgers,
    });
  } catch (error) {
    console.error("Ledger retrieval failed:", error);

    return NextResponse.json(
      { error: "Failed to retrieve the ledger." },
      { status: 500 }
    );
  }
}
