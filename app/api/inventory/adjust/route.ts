import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

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

    const productId = String(
      body.productId ?? ""
    ).trim();

    const type = String(
      body.type ?? ""
    ).trim();

    const quantity = Number(body.quantity);

    if (!productId) {
      return NextResponse.json(
        { error: "Product is required." },
        { status: 400 }
      );
    }

    if (
      type !== "ADD" &&
      type !== "REMOVE"
    ) {
      return NextResponse.json(
        { error: "Invalid adjustment type." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Quantity must be a positive whole number.",
        },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
        name: true,
        initialStock: true,
        isActive: true,
      },
    });

    if (!product || !product.isActive) {
      return NextResponse.json(
        { error: "Product not found or inactive." },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const transactions =
          await tx.inventoryTransaction.findMany({
            where: {
              productId,
            },
            select: {
              type: true,
              quantity: true,
            },
          });

        let currentStock = 0;

        const hasInitialStockTransaction =
          transactions.some(
            (transaction) =>
              transaction.type === "INITIAL_STOCK"
          );

        if (!hasInitialStockTransaction) {
          currentStock += product.initialStock;
        }

        for (const transaction of transactions) {
          switch (transaction.type) {
            case "INITIAL_STOCK":
            case "PRODUCTION":
            case "STOCK_ADJUSTMENT_ADD":
              currentStock += transaction.quantity;
              break;

            case "SALE":
            case "STOCK_ADJUSTMENT_REMOVE":
            case "PRODUCTION_REVERSAL":
              currentStock -= transaction.quantity;
              break;

            case "SALE_VOID":
              currentStock += transaction.quantity;
              break;

            default:
              break;
          }
        }

        if (
          type === "REMOVE" &&
          quantity > currentStock
        ) {
          throw new Error(
            `INSUFFICIENT_STOCK:${currentStock}`
          );
        }

        const transaction =
          await tx.inventoryTransaction.create({
            data: {
              productId,
              type:
                type === "ADD"
                  ? "STOCK_ADJUSTMENT_ADD"
                  : "STOCK_ADJUSTMENT_REMOVE",
              quantity,
              referenceType: "STOCK_ADJUSTMENT",
              referenceId: productId,
              createdById: admin.id,
            },
          });

        const newStock =
          type === "ADD"
            ? currentStock + quantity
            : currentStock - quantity;

        await createAuditLog(
          {
            userId: admin.id,
            action: "UPDATE",
            entityType: "INVENTORY",
            entityId: product.id,
            oldValue: {
              productId: product.id,
              productName: product.name,
              stock: currentStock,
            },
            newValue: {
              productId: product.id,
              productName: product.name,
              stock: newStock,
              adjustmentType: type,
              quantity,
            },
          },
          tx
        );

        return {
          transaction,
          previousStock: currentStock,
          newStock,
        };
      }
    );

    return NextResponse.json(
      {
        message: "Stock adjusted successfully.",
        previousStock: result.previousStock,
        newStock: result.newStock,
        transaction: result.transaction,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Inventory adjustment failed:",
      error
    );

    if (
      error instanceof Error &&
      error.message.startsWith(
        "INSUFFICIENT_STOCK:"
      )
    ) {
      const availableStock =
        error.message.split(":")[1];

      return NextResponse.json(
        {
          error: `Insufficient stock. Available stock: ${availableStock}.`,
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