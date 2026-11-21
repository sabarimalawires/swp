import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { getCustomerLedgerBalance } from "@/src/lib/ledger-balance";

function roundKg(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function financialYearStart(year: number) {
  return new Date(year, 3, 1);
}

function getFinancialYear(date: Date) {
  return date.getMonth() < 3
    ? date.getFullYear() - 1
    : date.getFullYear();
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

    const now = new Date();
    const params = new URL(request.url).searchParams;

    const selectedMonth = params.has("month") ? Number(params.get("month")) : now.getMonth() + 1;
    const selectedYear = params.has("year") ? Number(params.get("year")) : now.getFullYear();
    const salesMonth = params.has("salesMonth") ? Number(params.get("salesMonth")) : now.getMonth() + 1;
    const salesYear = params.has("salesYear") ? Number(params.get("salesYear")) : now.getFullYear();
    const purchaseMonth = params.has("purchaseMonth") ? Number(params.get("purchaseMonth")) : now.getMonth() + 1;
    const purchaseYear = params.has("purchaseYear") ? Number(params.get("purchaseYear")) : now.getFullYear();

    const period = params.get("period") || "monthly";
    const selectedFY = params.has("fy")
      ? Number(params.get("fy"))
      : getFinancialYear(now);

    if (
      !Number.isInteger(selectedMonth) ||
      selectedMonth < 1 ||
      selectedMonth > 12 ||
      !Number.isInteger(selectedYear) ||
      selectedYear < 2000 ||
      selectedYear > 2100 ||
      !Number.isInteger(selectedFY) ||
      selectedFY < 2000 ||
      selectedFY > 2100 ||
      ![salesMonth, purchaseMonth].every(
        (month) => Number.isInteger(month) && month >= 1 && month <= 12
      ) ||
      ![salesYear, purchaseYear].every(
        (year) => Number.isInteger(year) && year >= 2000 && year <= 2100
      ) ||
      !["daily", "monthly", "yearly"].includes(period)
    ) {
      return NextResponse.json(
        { error: "Invalid dashboard filters." },
        { status: 400 }
      );
    }

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
    const nextMonthStart = new Date(selectedYear, selectedMonth, 1);

    const salesMonthStart = new Date(salesYear, salesMonth - 1, 1);
    const salesNextMonthStart = new Date(salesYear, salesMonth, 1);

    const purchaseMonthStart = new Date(purchaseYear, purchaseMonth - 1, 1);
    const purchaseNextMonthStart = new Date(purchaseYear, purchaseMonth, 1);

    const fyStart = financialYearStart(selectedFY);
    const nextFYStart = financialYearStart(selectedFY + 1);

    // Chart date range and buckets.
    let chartStart: Date;
    let chartEnd: Date;
    let chartBuckets: { label: string; start: Date; end: Date }[] = [];

    if (period === "daily") {
      chartStart = new Date(todayStart);
      chartStart.setDate(chartStart.getDate() - 29);
      chartEnd = new Date(tomorrowStart);

      chartBuckets = Array.from({ length: 30 }, (_, i) => {
        const start = new Date(chartStart);
        start.setDate(start.getDate() + i);

        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        return {
          label: start.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          }),
          start,
          end,
        };
      });
    } else if (period === "monthly") {
      chartStart = fyStart;
      chartEnd = nextFYStart;

      chartBuckets = Array.from({ length: 12 }, (_, i) => {
        const start = new Date(selectedFY, 3 + i, 1);
        const end = new Date(selectedFY, 4 + i, 1);

        return {
          label: start.toLocaleDateString("en-IN", {
            month: "short",
          }),
          start,
          end,
        };
      });
    } else {
      chartStart = financialYearStart(selectedFY - 4);
      chartEnd = nextFYStart;

      chartBuckets = Array.from({ length: 5 }, (_, i) => {
        const year = selectedFY - 4 + i;

        return {
          label: `FY ${String(year).slice(-2)}-${String(year + 1).slice(-2)}`,
          start: financialYearStart(year),
          end: financialYearStart(year + 1),
        };
      });
    }

    const [
      todaysWork,
      todaysSales,
      monthlyWork,
      monthlySales,
      selectedSalesKpi,
      selectedPurchaseKpi,
      chartSales,
      pendingWork,
      products,
      inventoryTransactions,
      customers,
    ] = await Promise.all([
      prisma.workEntry.findMany({
        where: {
          status: "APPROVED",
          submittedAt: { gte: todayStart, lt: tomorrowStart },
        },
        select: { weight: true },
      }),

      prisma.sale.findMany({
        where: {
          status: "ACTIVE",
          saleDate: { gte: todayStart, lt: tomorrowStart },
        },
        select: { weight: true, amount: true },
      }),

      prisma.workEntry.findMany({
        where: {
          status: "APPROVED",
          submittedAt: { gte: monthStart, lt: nextMonthStart },
        },
        select: { weight: true },
      }),

      prisma.sale.findMany({
        where: {
          status: "ACTIVE",
          saleDate: { gte: monthStart, lt: nextMonthStart },
        },
        select: { weight: true, amount: true },
      }),

      // Monthly Sales KPI for the independently selected month.
      prisma.sale.findMany({
        where: {
          status: "ACTIVE",
          saleDate: { gte: salesMonthStart, lt: salesNextMonthStart },
        },
        select: { weight: true, amount: true },
      }),

      // Monthly Purchase KPI for the independently selected month.
      prisma.purchase.findMany({
        where: {
          status: "ACTIVE",
          purchaseDate: {
            gte: purchaseMonthStart,
            lt: purchaseNextMonthStart,
          },
        },
        select: {
          totalAmount: true,
          items: {
            select: { weight: true },
          },
        },
      }),

      prisma.sale.findMany({
        where: {
          status: "ACTIVE",
          saleDate: { gte: chartStart, lt: chartEnd },
        },
        select: { saleDate: true, amount: true },
        orderBy: { saleDate: "asc" },
      }),

      prisma.workEntry.count({
        where: { status: "PENDING" },
      }),

      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          initialStockKg: true,
          lowStockThresholdKg: true,
        },
        orderBy: { name: "asc" },
      }),

      prisma.inventoryTransaction.findMany({
        select: {
          productId: true,
          type: true,
          weight: true,
        },
        orderBy: { createdAt: "asc" },
      }),

      prisma.customer.findMany({
        select: { id: true },
      }),
    ]);

    const todaysProduction = roundKg(
      todaysWork.reduce((sum, entry) => sum + Number(entry.weight), 0)
    );

    const salesAmountToday = roundMoney(
      todaysSales.reduce((sum, sale) => sum + Number(sale.amount), 0)
    );

    const salesQuantityToday = roundKg(
      todaysSales.reduce((sum, sale) => sum + Number(sale.weight), 0)
    );

    // Monthly Sales KPI.
    const selectedSalesSummary = {
      amount: roundMoney(
        selectedSalesKpi.reduce(
          (sum, sale) => sum + Number(sale.amount),
          0
        )
      ),
      count: selectedSalesKpi.length,
      weight: roundKg(
        selectedSalesKpi.reduce(
          (sum, sale) => sum + Number(sale.weight),
          0
        )
      ),
    };

    // Monthly Purchase KPI.
    const selectedPurchaseSummary = {
      amount: roundMoney(
        selectedPurchaseKpi.reduce(
          (sum, purchase) => sum + Number(purchase.totalAmount),
          0
        )
      ),
      count: selectedPurchaseKpi.length,
      weight: roundKg(
        selectedPurchaseKpi.reduce(
          (sum, purchase) =>
            sum +
            purchase.items.reduce(
              (itemSum, item) => itemSum + Number(item.weight),
              0
            ),
          0
        )
      ),
    };

    const monthlyProduction = roundKg(
      monthlyWork.reduce((sum, entry) => sum + Number(entry.weight), 0)
    );

    const monthlySalesAmount = roundMoney(
      monthlySales.reduce((sum, sale) => sum + Number(sale.amount), 0)
    );

    const monthlySalesQuantity = roundKg(
      monthlySales.reduce((sum, sale) => sum + Number(sale.weight), 0)
    );

    // Customer ledger summary for the selected financial year.
    const customerLedgerBalances = await Promise.all(
      customers.map((customer) =>
        getCustomerLedgerBalance(customer.id, selectedFY)
      )
    );

    const ledgerSummary = {
      openingBalance: roundMoney(
        customerLedgerBalances.reduce(
          (sum, ledger) => sum + ledger.openingBalance,
          0
        )
      ),
      totalSales: roundMoney(
        customerLedgerBalances.reduce(
          (sum, ledger) => sum + ledger.totalSales,
          0
        )
      ),
      closingBalance: roundMoney(
        customerLedgerBalances.reduce(
          (sum, ledger) => sum + ledger.closingBalance,
          0
        )
      ),
    };

    // Reconstruct inventory from opening stock and kg transactions.
    const inventoryByProduct = new Map<string, number>();

    for (const product of products) {
      inventoryByProduct.set(product.id, Number(product.initialStockKg));
    }

    const productsWithInitialTransaction = new Set(
      inventoryTransactions
        .filter((transaction) => transaction.type === "INITIAL_STOCK")
        .map((transaction) => transaction.productId)
    );

    for (const productId of productsWithInitialTransaction) {
      inventoryByProduct.set(productId, 0);
    }

    for (const transaction of inventoryTransactions) {
      if (!inventoryByProduct.has(transaction.productId)) continue;

      const weight = Number(transaction.weight);
      if (!Number.isFinite(weight) || weight === 0) continue;

      const current = inventoryByProduct.get(transaction.productId) ?? 0;

      switch (transaction.type) {
        case "INITIAL_STOCK":
        case "PRODUCTION":
        case "PURCHASE":
        case "STOCK_ADJUSTMENT_ADD":
        case "SALE_VOID":
          inventoryByProduct.set(
            transaction.productId,
            roundKg(current + weight)
          );
          break;

        case "SALE":
        case "PURCHASE_VOID":
        case "PURCHASE_EDIT_REVERSAL":
        case "STOCK_ADJUSTMENT_REMOVE":
        case "PRODUCTION_REVERSAL":
          inventoryByProduct.set(
            transaction.productId,
            roundKg(Math.max(0, current - weight))
          );
          break;
      }
    }

    const lowStockProducts = products
      .map((product) => ({
        id: product.id,
        name: product.name,
        code: product.code,
        stock: roundKg(inventoryByProduct.get(product.id) ?? 0),
        lowStockThreshold: Number(product.lowStockThresholdKg),
      }))
      .filter((product) => product.stock <= product.lowStockThreshold)
      .sort((a, b) => a.stock - b.stock);

    const totalInventory = roundKg(
      products.reduce(
        (sum, product) =>
          sum + (inventoryByProduct.get(product.id) ?? 0),
        0
      )
    );

    const salesTrend = chartBuckets.map((bucket) => {
      const amount = chartSales
        .filter((sale) => {
          const date = new Date(sale.saleDate);
          return date >= bucket.start && date < bucket.end;
        })
        .reduce((sum, sale) => sum + Number(sale.amount), 0);

      return {
        label: bucket.label,
        amount: roundMoney(amount),
      };
    });

    return NextResponse.json({
      salesAmountToday,
      todaysSales: todaysSales.length,
      salesQuantityToday,
      todaysProduction,

      monthlySalesKpi: selectedSalesSummary,
      monthlyPurchaseKpi: selectedPurchaseSummary,

      monthlyBusiness: {
        salesCount: monthlySales.length,
        salesAmount: monthlySalesAmount,
        salesQuantity: monthlySalesQuantity,
        production: monthlyProduction,
        selectedMonth,
        selectedYear,
      },

      ledgerSummary,
      pendingWork,
      activeProducts: products.length,

      lowStockCount: lowStockProducts.length,
      lowStockProducts,
      totalInventory,

      salesTrend,
      chartPeriod: period,
      selectedFY,
    });
  } catch (error) {
    console.error("Dashboard loading failed:", error);

    return NextResponse.json(
      { error: "Failed to load dashboard data." },
      { status: 500 }
    );
  }
}