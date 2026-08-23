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
        { status: 401 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: {
        authUserId: session.user.id,
      },
      select: {
        status: true,
      },
    });

    if (!employee || employee.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Employee access required." },
        { status: 403 }
      );
    }

    const products = await prisma.product.findMany({
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
    });

    const transactions =
      await prisma.inventoryTransaction.findMany({
        where: {
          productId: {
            in: products.map((product) => product.id),
          },
        },
        select: {
          productId: true,
          type: true,
          quantity: true,
        },
      });

    const inventory = products.map((product) => {
      const productTransactions = transactions.filter(
        (transaction) =>
          transaction.productId === product.id
      );

      let stock = 0;

      for (const transaction of productTransactions) {
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

      /*
       * If the initial stock has not yet been represented
       * by an INITIAL_STOCK transaction, include the
       * Product.initialStock value.
       */
      const hasInitialStockTransaction =
        productTransactions.some(
          (transaction) =>
            transaction.type === "INITIAL_STOCK"
        );

      if (!hasInitialStockTransaction) {
        stock += product.initialStock;
      }

      return {
        id: product.id,
        name: product.name,
        code: product.code,
        stock,
        lowStockThreshold:
          product.lowStockThreshold,
        isLowStock:
          stock <= product.lowStockThreshold,
      };
    });

    return NextResponse.json(inventory);
  } catch (error) {
    console.error(
      "Inventory lookup failed:",
      error
    );

    return NextResponse.json(
      { error: "Failed to load inventory." },
      { status: 500 }
    );
  }
}