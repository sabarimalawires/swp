import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";

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

    /*
     * TODAY
     */
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(
      tomorrowStart.getDate() + 1
    );

    /*
     * CURRENT MONTH
     */
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

    /*
     * TODAY'S APPROVED PRODUCTION
     */
    const todaysApprovedWork =
      await prisma.workEntry.findMany({
        where: {
          status: "APPROVED",
          submittedAt: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
        select: {
          quantity: true,
        },
      });

    const todaysProduction =
      todaysApprovedWork.reduce(
        (total, entry) =>
          total + entry.quantity,
        0
      );

    /*
     * TODAY'S ACTIVE SALES
     */
    const todaysSales =
      await prisma.sale.findMany({
        where: {
          status: "ACTIVE",
          saleDate: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
        select: {
          quantity: true,
        },
      });

    const todaysSalesCount =
      todaysSales.length;

    const unitsSoldToday =
      todaysSales.reduce(
        (total, sale) =>
          total + sale.quantity,
        0
      );

    /*
     * MONTHLY PRODUCTION
     *
     * Only APPROVED work entries count.
     */
    const monthlyApprovedWork =
      await prisma.workEntry.findMany({
        where: {
          status: "APPROVED",
          submittedAt: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
        select: {
          quantity: true,
        },
      });

    const monthlyProduction =
      monthlyApprovedWork.reduce(
        (total, entry) =>
          total + entry.quantity,
        0
      );

    /*
     * MONTHLY SALES
     *
     * Only ACTIVE sales count.
     * Voided sales are excluded.
     */
    const monthlySales =
      await prisma.sale.findMany({
        where: {
          status: "ACTIVE",
          saleDate: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
        select: {
          quantity: true,
        },
      });

    const monthlySalesQuantity =
      monthlySales.reduce(
        (total, sale) =>
          total + sale.quantity,
        0
      );

    /*
     * BASIC DASHBOARD COUNTS
     */
    const [
      pendingWork,
      activeProducts,
      products,
      inventoryTransactions,
    ] = await Promise.all([
      prisma.workEntry.count({
        where: {
          status: "PENDING",
        },
      }),

      prisma.product.count({
        where: {
          isActive: true,
        },
      }),

      prisma.product.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          code: true,
          initialStock: true,
          lowStockThreshold: true,
        },
        orderBy: {
          name: "asc",
        },
      }),

      prisma.inventoryTransaction.findMany({
        select: {
          productId: true,
          type: true,
          quantity: true,
        },
      }),
    ]);

    /*
     * CALCULATE CURRENT INVENTORY
     */
    const inventoryByProduct = new Map<
      string,
      number
    >();

    for (const product of products) {
      inventoryByProduct.set(
        product.id,
        product.initialStock
      );
    }

    /*
     * If an INITIAL_STOCK transaction exists,
     * use the transaction ledger instead of
     * adding initialStock separately.
     */
    for (const product of products) {
      const hasInitialStockTransaction =
        inventoryTransactions.some(
          (transaction) =>
            transaction.productId ===
              product.id &&
            transaction.type ===
              "INITIAL_STOCK"
        );

      if (hasInitialStockTransaction) {
        inventoryByProduct.set(
          product.id,
          0
        );
      }
    }

    /*
     * Apply inventory ledger.
     */
    for (const transaction of inventoryTransactions) {
      if (!inventoryByProduct.has(
        transaction.productId
      )) {
        continue;
      }

      const current =
        inventoryByProduct.get(
          transaction.productId
        ) ?? 0;

      switch (transaction.type) {
        case "INITIAL_STOCK":
        case "PRODUCTION":
        case "STOCK_ADJUSTMENT_ADD":
          inventoryByProduct.set(
            transaction.productId,
            current + transaction.quantity
          );
          break;

        case "SALE":
        case "STOCK_ADJUSTMENT_REMOVE":
        case "PRODUCTION_REVERSAL":
          inventoryByProduct.set(
            transaction.productId,
            current - transaction.quantity
          );
          break;

        case "SALE_VOID":
          inventoryByProduct.set(
            transaction.productId,
            current + transaction.quantity
          );
          break;

        default:
          break;
      }
    }

    /*
     * LOW STOCK PRODUCTS
     */
    const lowStockProducts = products
      .map((product) => {
        const stock =
          inventoryByProduct.get(
            product.id
          ) ?? 0;

        return {
          id: product.id,
          name: product.name,
          code: product.code,
          stock,
          lowStockThreshold:
            product.lowStockThreshold,
        };
      })
      .filter(
        (product) =>
          product.stock <=
          product.lowStockThreshold
      );

    /*
     * TOTAL CURRENT INVENTORY
     *
     * This is the total quantity currently
     * available across all active products.
     */
    const totalInventory =
      products.reduce(
        (total, product) =>
          total +
          (inventoryByProduct.get(
            product.id
          ) ?? 0),
        0
      );

    /*
     * MONTHLY BUSINESS DATA
     */
    const monthlyBusiness = {
      production: monthlyProduction,
      sales: monthlySalesQuantity,
      inventory: totalInventory,
    };

    return NextResponse.json({
      pendingWork,

      activeProducts,

      todaysSales:
        todaysSalesCount,

      unitsSoldToday,

      todaysProduction,

      lowStockCount:
        lowStockProducts.length,

      lowStockProducts,

      monthlyBusiness,
    });
  } catch (error) {
    console.error(
      "Dashboard loading failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load dashboard data.",
      },
      { status: 500 }
    );
  }
}