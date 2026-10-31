
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

  // Inventory weight remains in kilograms.
  weight: money(sale.weight),

  // Individual product sales details.
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

    // Actual inventory deduction in kilograms.
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
            balance: Number(balance.toFixed(2)),
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
          totalSales: Number(totalSales.toFixed(2)),
          totalPayments: Number(totalPayments.toFixed(2)),
          closingBalance: Number(
            (openingBalance + totalSales - totalPayments).toFixed(2)
          ),
          openingBalanceIsManualOverride:
  ledgerBalance.openingBalanceIsManualOverride,
          rows,
        };
      })
    );

    return NextResponse.json({
      financialYear: `${year}-${String(year + 1).slice(-2)}`,
      summary: {
        customerCount: ledgers.length,
        openingBalance: Number(
          ledgers.reduce((sum, ledger) => sum + ledger.openingBalance, 0).toFixed(2)
        ),
        totalSales: Number(
          ledgers.reduce((sum, ledger) => sum + ledger.totalSales, 0).toFixed(2)
        ),
        totalPayments: Number(
          ledgers.reduce((sum, ledger) => sum + ledger.totalPayments, 0).toFixed(2)
        ),
        closingBalance: Number(
          ledgers.reduce((sum, ledger) => sum + ledger.closingBalance, 0).toFixed(2)
        ),
      },
      ledgers,
    });
  } catch (error) {
    console.error("Ledger retrieval failed:", error);

    return NextResponse.json(
      { error: "Failed to retrieve the sales ledger." },
      { status: 500 }
    );
  }
}
