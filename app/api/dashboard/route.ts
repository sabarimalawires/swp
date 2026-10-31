
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { getCustomerLedgerBalance } from "@/src/lib/ledger-balance";

function roundKg(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function roundMoney(value: number): number {
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

    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const nextMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1
    );

    // Today's approved production.
    const todaysApprovedWork = await prisma.workEntry.findMany({
      where: {
        status: "APPROVED",
        submittedAt: {
          gte: todayStart,
          lt: tomorrowStart,
        },
      },
      select: {
  weight: true,
},
    });

    const todaysProduction = roundKg(
  todaysApprovedWork.reduce(
    (total, entry) => total + Number(entry.weight),
    0
  )
);

    // Today's active sales.
    const todaysSales = await prisma.sale.findMany({
      where: {
        status: "ACTIVE",
        saleDate: {
          gte: todayStart,
          lt: tomorrowStart,
        },
      },
      select: {
        weight: true,
      },
    });

    const todaysSalesCount = todaysSales.length;

    const salesQuantityToday = roundKg(
  todaysSales.reduce(
    (total, sale) => total + Number(sale.weight),
    0
  )
);

    // Monthly approved production.
    const monthlyApprovedWork = await prisma.workEntry.findMany({
      where: {
        status: "APPROVED",
        submittedAt: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
      select: {
        weight: true,
      },
    });

    const monthlyProduction = roundKg(
  monthlyApprovedWork.reduce(
    (total, entry) => total + Number(entry.weight),
    0
  )
);

    // Monthly active sales.
    const monthlySales = await prisma.sale.findMany({
      where: {
        status: "ACTIVE",
        saleDate: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
      select: {
        weight: true,
      },
    });

    const monthlySalesQuantity = roundKg(
  monthlySales.reduce(
    (total, sale) => total + Number(sale.weight),
    0
  )
);

const [
  pendingWork,
  activeProducts,
  products,
  inventoryTransactions,
  customers,
] = await Promise.all([
  prisma.workEntry.count({
    where: { status: "PENDING" },
  }),

  prisma.product.count({
    where: { isActive: true },
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
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  }),

  prisma.customer.findMany({
    select: {
      id: true,
    },
  }),
]);

    // Overall customer ledger for the current financial year.
const financialYearStartYear =
  now.getFullYear() - (now.getMonth() < 3 ? 1 : 0);

const customerLedgerBalances = await Promise.all(
  customers.map((customer) =>
    getCustomerLedgerBalance(
      customer.id,
      financialYearStartYear
    )
  )
);

const ledgerSummary = {
  openingBalance: roundMoney(
    customerLedgerBalances.reduce(
      (total, ledger) => total + ledger.openingBalance,
      0
    )
  ),

  totalSales: roundMoney(
    customerLedgerBalances.reduce(
      (total, ledger) => total + ledger.totalSales,
      0
    )
  ),

  closingBalance: roundMoney(
    customerLedgerBalances.reduce(
      (total, ledger) => total + ledger.closingBalance,
      0
    )
  ),
};

    // Start from opening kg stock. If a nonzero kg opening-stock
    // transaction exists, use the ledger for that product instead.
    const inventoryByProduct = new Map<string, number>();

    for (const product of products) {
      inventoryByProduct.set(
        product.id,
        Number(product.initialStockKg)
      );
    }

    for (const product of products) {
      const hasKgInitialStockTransaction =
        inventoryTransactions.some(
          (transaction) =>
            transaction.productId === product.id &&
            transaction.type === "INITIAL_STOCK" &&
            Number(transaction.weight) !== 0
        );

      if (hasKgInitialStockTransaction) {
        inventoryByProduct.set(product.id, 0);
      }
    }

    // Reconstruct inventory from kg transactions only.
    // Legacy unit-only transactions (weight = 0) do not change kg stock.
    for (const transaction of inventoryTransactions) {
      if (!inventoryByProduct.has(transaction.productId)) {
        continue;
      }

      const weight = Number(transaction.weight);

      if (!Number.isFinite(weight) || weight === 0) {
        continue;
      }

      const current =
        inventoryByProduct.get(transaction.productId) ?? 0;

      switch (transaction.type) {
        case "INITIAL_STOCK":
        case "PRODUCTION":
        case "STOCK_ADJUSTMENT_ADD":
        case "SALE_VOID":
          inventoryByProduct.set(
            transaction.productId,
            roundKg(current + weight)
          );
          break;

        case "SALE":
        case "STOCK_ADJUSTMENT_REMOVE":
        case "PRODUCTION_REVERSAL":
          inventoryByProduct.set(
            transaction.productId,
            roundKg(current - weight)
          );
          break;

        default:
          break;
      }
    }

    // Products at or below their configured kg threshold.
    const lowStockProducts = products
      .map((product) => ({
        id: product.id,
        name: product.name,
        code: product.code,
        stock: roundKg(
          inventoryByProduct.get(product.id) ?? 0
        ),
        lowStockThreshold: Number(product.lowStockThresholdKg),
      }))
      .filter(
        (product) =>
          product.stock <= product.lowStockThreshold
      );

    const totalInventory = roundKg(
      products.reduce(
        (total, product) =>
          total + (inventoryByProduct.get(product.id) ?? 0),
        0
      )
    );

    const monthlyBusiness = {
  salesCount: monthlySales.length,
  salesQuantity: monthlySalesQuantity,
  production: monthlyProduction,
};

    return NextResponse.json({
  ledgerSummary,
  pendingWork,
  activeProducts,
  todaysSales: todaysSalesCount,
  salesQuantityToday,
  todaysProduction,
  lowStockCount: lowStockProducts.length,
  lowStockProducts,
  monthlyBusiness,
});
  } catch (error) {
    console.error("Dashboard loading failed:", error);

    return NextResponse.json(
      { error: "Failed to load dashboard data." },
      { status: 500 }
    );
  }
}
