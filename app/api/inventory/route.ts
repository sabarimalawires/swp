
import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { authUserId: session.user.id },
      select: { status: true },
    });

    if (!employee || employee.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Employee access required." },
        { status: 403 },
      );
    }

    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        initialStockKg: true,
        lowStockThresholdKg: true,
      },
      orderBy: { name: "asc" },
    });

    const productIds = products.map((product) => product.id);

    const transactions = productIds.length
      ? await prisma.inventoryTransaction.findMany({
          where: { productId: { in: productIds } },
          select: {
            productId: true,
            type: true,
            weight: true,
          },
          orderBy: { createdAt: "asc" },
        })
      : [];

    const inventory = products.map((product) => {
      const productTransactions = transactions.filter(
        (transaction) => transaction.productId === product.id,
      );

      let stockKg = 0;

      for (const transaction of productTransactions) {
        const weightKg = Number(transaction.weight);

        // Legacy transactions have no verified kg value.
        // Never interpret their old unit quantity as kilograms.
        if (!Number.isFinite(weightKg) || weightKg === 0) {
          continue;
        }

        switch (transaction.type) {
          case "INITIAL_STOCK":
          case "PRODUCTION":
          case "STOCK_ADJUSTMENT_ADD":
          case "SALE_VOID":
            stockKg += weightKg;
            break;

          case "SALE":
          case "STOCK_ADJUSTMENT_REMOVE":
          case "PRODUCTION_REVERSAL":
            stockKg -= weightKg;
            break;

          default:
            break;
        }
      }

      // Use the product's kg opening balance unless a verified,
      // non-zero kg INITIAL_STOCK transaction already represents it.
      const hasKgInitialStockTransaction = productTransactions.some(
        (transaction) =>
          transaction.type === "INITIAL_STOCK" &&
          Number(transaction.weight) !== 0,
      );

      if (!hasKgInitialStockTransaction) {
        stockKg += Number(product.initialStockKg);
      }

      // Keep three decimal places without clamping negative stock.
      stockKg = Math.round((stockKg + Number.EPSILON) * 1000) / 1000;

      const lowStockThresholdKg = Number(
        product.lowStockThresholdKg,
      );

      return {
        id: product.id,
        name: product.name,
        code: product.code,
        stockKg,
        lowStockThresholdKg,
        isLowStock: stockKg <= lowStockThresholdKg,
      };
    });

    return NextResponse.json(inventory);
  } catch (error) {
    console.error("Inventory lookup failed:", error);

    return NextResponse.json(
      { error: "Failed to load inventory." },
      { status: 500 },
    );
  }
}
