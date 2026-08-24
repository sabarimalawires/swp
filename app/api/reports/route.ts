import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";

function parseDate(
  value: string | null,
  endOfDay = false
) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
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

    const fromValue = searchParams.get("from");
    const toValue = searchParams.get("to");
    const productId = searchParams.get("productId");
    const workerId = searchParams.get("workerId");

    const fromDate = parseDate(fromValue);
    const toDate = parseDate(toValue, true);

    if (fromDate === null) {
      return NextResponse.json(
        { error: "Invalid start date." },
        { status: 400 }
      );
    }

    if (toDate === null) {
      return NextResponse.json(
        { error: "Invalid end date." },
        { status: 400 }
      );
    }

    if (fromDate && toDate && fromDate > toDate) {
      return NextResponse.json(
        {
          error:
            "Start date cannot be later than end date.",
        },
        { status: 400 }
      );
    }

    if (productId) {
      const product = await prisma.product.findUnique({
        where: {
          id: productId,
        },
        select: {
          id: true,
          name: true,
          code: true,
        },
      });

      if (!product) {
        return NextResponse.json(
          {
            error:
              "Selected product was not found.",
          },
          { status: 404 }
        );
      }
    }

    if (workerId) {
      const worker = await prisma.employee.findUnique({
        where: {
          id: workerId,
        },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          status: true,
        },
      });

      if (
        !worker ||
        worker.role !== "WORKER" ||
        worker.status !== "ACTIVE"
      ) {
        return NextResponse.json(
          {
            error:
              "Selected worker was not found.",
          },
          { status: 404 }
        );
      }
    }

    const dateFilter =
      fromDate || toDate
        ? {
            ...(fromDate
              ? { gte: fromDate }
              : {}),
            ...(toDate
              ? { lte: toDate }
              : {}),
          }
        : undefined;

    /*
     * Work is filtered by:
     * - submitted date
     * - product
     * - worker
     */
    const workWhere = {
      ...(dateFilter
        ? {
            submittedAt: dateFilter,
          }
        : {}),
      ...(productId
        ? {
            productId,
          }
        : {}),
      ...(workerId
        ? {
            workerId,
          }
        : {}),
    };

    /*
     * Sales are filtered by:
     * - sale date
     * - product
     *
     * Worker does NOT filter sales because
     * the report's Worker filter represents
     * production/work activity.
     */
    const saleWhere = {
      ...(dateFilter
        ? {
            saleDate: dateFilter,
          }
        : {}),
      ...(productId
        ? {
            productId,
          }
        : {}),
    };

    /*
     * Inventory is current inventory.
     *
     * It is filtered by product only.
     *
     * We do NOT apply the worker filter because
     * inventory belongs to the business/product,
     * not to an individual worker.
     */
    const inventoryWhere = {
      ...(productId
        ? {
            productId,
          }
        : {}),
    };

    const [
      totalWork,
      approvedWork,
      rejectedWork,
      pendingWork,
      activeSales,
      voidedSales,
      inventoryTransactions,
      products,
      workEntries,
      sales,
      selectedProduct,
      selectedWorker,
    ] = await Promise.all([
      prisma.workEntry.count({
        where: workWhere,
      }),

      prisma.workEntry.count({
        where: {
          ...workWhere,
          status: "APPROVED",
        },
      }),

      prisma.workEntry.count({
        where: {
          ...workWhere,
          status: "REJECTED",
        },
      }),

      prisma.workEntry.count({
        where: {
          ...workWhere,
          status: "PENDING",
        },
      }),

      prisma.sale.findMany({
        where: {
          ...saleWhere,
          status: "ACTIVE",
        },
        select: {
          id: true,
          productId: true,
          quantity: true,
          weight: true,
          amount: true,
          saleDate: true,
          status: true,

          customer: {
            select: {
              id: true,
              name: true,
            },
          },

          product: {
            select: {
              name: true,
              code: true,
            },
          },

          payments: {
            select: {
              id: true,
              amount: true,
              paymentDate: true,
            },
            orderBy: {
              paymentDate: "asc",
            },
          },
        },
        orderBy: {
          saleDate: "desc",
        },
      }),

      prisma.sale.count({
        where: {
          ...saleWhere,
          status: "VOIDED",
        },
      }),

      prisma.inventoryTransaction.findMany({
        where: inventoryWhere,
        select: {
          productId: true,
          type: true,
          quantity: true,
        },
      }),

      prisma.product.findMany({
        where: {
          isActive: true,
          ...(productId
            ? {
                id: productId,
              }
            : {}),
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

      prisma.workEntry.findMany({
        where: workWhere,
        select: {
          id: true,
          quantity: true,
          status: true,
          submittedAt: true,

          worker: {
            select: {
              name: true,
              username: true,
            },
          },

          product: {
            select: {
              name: true,
              code: true,
            },
          },
        },
        orderBy: {
          submittedAt: "desc",
        },
      }),

      prisma.sale.findMany({
        where: saleWhere,
        select: {
          id: true,
          productId: true,
          quantity: true,
          weight: true,
          amount: true,
          saleDate: true,
          status: true,

          customer: {
            select: {
              id: true,
              name: true,
            },
          },

          product: {
            select: {
              name: true,
              code: true,
            },
          },

          payments: {
            select: {
              id: true,
              amount: true,
              paymentDate: true,
            },
            orderBy: {
              paymentDate: "asc",
            },
          },
        },
        orderBy: {
          saleDate: "desc",
        },
      }),

      productId
        ? prisma.product.findUnique({
            where: {
              id: productId,
            },
            select: {
              id: true,
              name: true,
              code: true,
            },
          })
        : Promise.resolve(null),

      workerId
        ? prisma.employee.findUnique({
            where: {
              id: workerId,
            },
            select: {
              id: true,
              name: true,
              username: true,
            },
          })
        : Promise.resolve(null),
    ]);

    /*
     * Production is calculated from APPROVED work entries.
     */
    const totalProduction =
      workEntries
        .filter(
          (entry) =>
            entry.status === "APPROVED"
        )
        .reduce(
          (total, entry) =>
            total + entry.quantity,
          0
        );

    const totalSalesQuantity =
      activeSales.reduce(
        (total, sale) =>
          total + sale.quantity,
        0
      );

    /*
     * Current inventory is calculated from the
     * complete inventory ledger.
     */
    const stockByProduct = products.map(
      (product) => {
        const transactions =
          inventoryTransactions.filter(
            (transaction) =>
              transaction.productId ===
              product.id
          );

        let stock = 0;

        const hasInitialStockTransaction =
          transactions.some(
            (transaction) =>
              transaction.type ===
              "INITIAL_STOCK"
          );

        if (!hasInitialStockTransaction) {
          stock += product.initialStock;
        }

        for (const transaction of transactions) {
          switch (transaction.type) {
            case "INITIAL_STOCK":
            case "PRODUCTION":
            case "STOCK_ADJUSTMENT_ADD":
              stock += transaction.quantity;
              break;

            case "SALE":
            case "STOCK_ADJUSTMENT_REMOVE":
            case "PRODUCTION_REVERSAL":
              stock -= transaction.quantity;
              break;

            case "SALE_VOID":
              stock += transaction.quantity;
              break;

            default:
              break;
          }
        }

        return {
          id: product.id,
          name: product.name,
          code: product.code,
          stock,
          lowStockThreshold:
            product.lowStockThreshold,
          isLowStock:
            stock <=
            product.lowStockThreshold,
        };
      }
    );

    const lowStockProducts =
      stockByProduct.filter(
        (product) =>
          product.isLowStock
      );

    /*
     * Convert Prisma Decimal values to regular
     * numbers for the JSON response and calculate
     * the customer's outstanding balance per sale.
     */
    const formatSales = (saleList: typeof sales) =>
      saleList.map((sale) => {
        const totalPaid =
          sale.payments.reduce(
            (total, payment) =>
              total + Number(payment.amount),
            0
          );

        const saleAmount =
          Number(sale.amount);

        return {
          id: sale.id,

          customer: sale.customer,

          productId: sale.productId,

          product: sale.product,

          quantity: sale.quantity,

          weight: Number(sale.weight),

          amount: saleAmount,

          totalPaid,

          balance: Math.max(
            0,
            saleAmount - totalPaid
          ),

          saleDate: sale.saleDate,

          status: sale.status,

          payments:
            sale.payments.map(
              (payment) => ({
                id: payment.id,
                amount: Number(
                  payment.amount
                ),
                paymentDate:
                  payment.paymentDate,
              })
            ),
        };
      });

    const formattedActiveSales =
      formatSales(activeSales);

    const formattedSales =
      formatSales(sales);

    return NextResponse.json({
      report: {
        type: "OVERALL",

        generatedAt:
          new Date().toISOString(),

        generatedBy: {
          id: admin.id,
          name: admin.name,
          username: admin.username,
        },

        filters: {
          from: fromValue || null,
          to: toValue || null,

          product: selectedProduct
            ? {
                id: selectedProduct.id,
                name: selectedProduct.name,
                code: selectedProduct.code,
              }
            : null,

          worker: selectedWorker
            ? {
                id: selectedWorker.id,
                name: selectedWorker.name,
                username:
                  selectedWorker.username,
              }
            : null,
        },

        summary: {
          totalWorkEntries:
            totalWork,

          approvedWorkEntries:
            approvedWork,

          rejectedWorkEntries:
            rejectedWork,

          pendingWorkEntries:
            pendingWork,

          totalProduction,

          totalSalesQuantity,

          totalActiveSales:
            formattedActiveSales.length,

          totalVoidedSales:
            voidedSales,

          lowStockProductCount:
            lowStockProducts.length,
        },

        inventory: {
          products: stockByProduct,
          lowStockProducts,
        },

        workEntries,

        sales: formattedSales,
      },
    });
  } catch (error) {
    console.error(
      "Overall report generation failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to generate report.",
      },
      { status: 500 }
    );
  }
}