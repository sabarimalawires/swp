
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

function roundKg(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function parseKg(value: unknown): number | null {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const text = String(value).trim();
  const parsed = Number(text);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0 ||
    !/^\d+(\.\d{1,3})?$/.test(text)
  ) {
    return null;
  }

  return parsed;
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const productId = String(body.productId ?? "").trim();
    const type = String(body.type ?? "").trim();
    const weightKg = parseKg(body.weightKg ?? body.weight);

    if (!productId) {
      return NextResponse.json(
        { error: "Product is required." },
        { status: 400 }
      );
    }

    if (type !== "ADD" && type !== "REMOVE") {
      return NextResponse.json(
        { error: "Invalid adjustment type." },
        { status: 400 }
      );
    }

    if (weightKg === null) {
      return NextResponse.json(
        { error: "Adjustment weight must be greater than 0 kg, with up to 3 decimal places." },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        initialStockKg: true,
        isActive: true,
      },
    });

    if (!product || !product.isActive) {
      return NextResponse.json(
        { error: "Product not found or inactive." },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const transactions = await tx.inventoryTransaction.findMany({
        where: { productId },
        select: {
          type: true,
          weight: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      });

      // Ignore legacy unit-only transactions: their quantity cannot
      // safely be interpreted as kilograms.
      const hasKgInitialStockTransaction = transactions.some(
        (transaction) =>
          transaction.type === "INITIAL_STOCK" &&
          Number(transaction.weight) !== 0
      );

      let currentStock = hasKgInitialStockTransaction
        ? 0
        : Number(product.initialStockKg);

      for (const transaction of transactions) {
        const weight = Number(transaction.weight);

        if (!Number.isFinite(weight) || weight === 0) {
          continue;
        }

        switch (transaction.type) {
          case "INITIAL_STOCK":
          case "PRODUCTION":
          case "STOCK_ADJUSTMENT_ADD":
          case "SALE_VOID":
            currentStock += weight;
            break;

          case "SALE":
          case "STOCK_ADJUSTMENT_REMOVE":
          case "PRODUCTION_REVERSAL":
            currentStock -= weight;
            break;

          default:
            break;
        }
      }

      currentStock = roundKg(currentStock);

      if (type === "REMOVE" && weightKg > currentStock) {
        throw new Error(`INSUFFICIENT_STOCK:${currentStock}`);
      }

      const transaction = await tx.inventoryTransaction.create({
        data: {
          productId,
          type:
            type === "ADD"
              ? "STOCK_ADJUSTMENT_ADD"
              : "STOCK_ADJUSTMENT_REMOVE",
          quantity: 0,
          weight: weightKg,
          referenceType: "STOCK_ADJUSTMENT",
          referenceId: productId,
          createdById: admin.id,
        },
      });

      const newStock = roundKg(
        type === "ADD"
          ? currentStock + weightKg
          : currentStock - weightKg
      );

      await createAuditLog(
        {
          userId: admin.id,
          action: "UPDATE",
          entityType: "INVENTORY",
          entityId: product.id,
          oldValue: {
            productId: product.id,
            productName: product.name,
            stockKg: currentStock,
          },
          newValue: {
            productId: product.id,
            productName: product.name,
            stockKg: newStock,
            adjustmentType: type,
            weightKg,
          },
        },
        tx
      );

      return {
        transaction,
        previousStockKg: currentStock,
        newStockKg: newStock,
      };
    });

    return NextResponse.json(
      {
        message: "Stock adjusted successfully.",
        previousStockKg: result.previousStockKg,
        newStockKg: result.newStockKg,
        transaction: result.transaction,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Inventory adjustment failed:", error);

    if (
      error instanceof Error &&
      error.message.startsWith("INSUFFICIENT_STOCK:")
    ) {
      const availableStock = error.message.slice(
        "INSUFFICIENT_STOCK:".length
      );

      return NextResponse.json(
        {
          error: `Insufficient stock. Available stock: ${availableStock} kg.`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to adjust stock." },
      { status: 500 }
    );
  }
}
