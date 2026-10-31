import { prisma } from "@/src/lib/prisma";

function money(value: unknown): number {
  return Number(value ?? 0);
}

export async function getCustomerLedgerBalance(
  customerId: string,
  year: number,
) {
  const start = new Date(Date.UTC(year, 3, 1));
  const end = new Date(Date.UTC(year + 1, 3, 1));

  const openingRecord =
    await prisma.customerLedgerOpeningBalance.findUnique({
      where: {
        customerId_financialYearStart: {
          customerId,
          financialYearStart: start,
        },
      },
    });

  let openingBalance: number;

  if (openingRecord) {
    openingBalance = money(openingRecord.openingBalance);
  } else {
    const previousStart = new Date(Date.UTC(year - 1, 3, 1));

    const previousOpeningRecord =
      await prisma.customerLedgerOpeningBalance.findUnique({
        where: {
          customerId_financialYearStart: {
            customerId,
            financialYearStart: previousStart,
          },
        },
      });

    const [
      historicalSales,
      historicalPayments,
      previousYearSales,
      previousYearPayments,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          customerId,
          status: "ACTIVE",
          saleDate: { lt: previousStart },
        },
        _sum: { amount: true },
      }),
      prisma.customerPayment.aggregate({
        where: {
          customerId,
          paymentDate: { lt: previousStart },
        },
        _sum: { amount: true },
      }),
      prisma.sale.aggregate({
        where: {
          customerId,
          status: "ACTIVE",
          saleDate: { gte: previousStart, lt: start },
        },
        _sum: { amount: true },
      }),
      prisma.customerPayment.aggregate({
        where: {
          customerId,
          paymentDate: { gte: previousStart, lt: start },
        },
        _sum: { amount: true },
      }),
    ]);

    const previousOpening = previousOpeningRecord
      ? money(previousOpeningRecord.openingBalance)
      : money(historicalSales._sum.amount) -
        money(historicalPayments._sum.amount);

    openingBalance =
      previousOpening +
      money(previousYearSales._sum.amount) -
      money(previousYearPayments._sum.amount);
  }

  const [sales, payments] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        customerId,
        status: "ACTIVE",
        saleDate: { gte: start, lt: end },
      },
      _sum: { amount: true },
    }),
    prisma.customerPayment.aggregate({
      where: {
        customerId,
        paymentDate: { gte: start, lt: end },
      },
      _sum: { amount: true },
    }),
  ]);

  const totalSales = money(sales._sum.amount);
  const totalPayments = money(payments._sum.amount);

  return {
  openingBalance,
  totalSales,
  totalPayments,
  closingBalance: Number(
    (openingBalance + totalSales - totalPayments).toFixed(2)
  ),
  openingBalanceIsManualOverride:
    openingRecord?.isManualOverride ?? false,
};
}