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
        initialStockQuantity: true,
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
  id: true,
  productId: true,
  type: true,
  quantity: true,
  weight: true,
},
orderBy: [
  { createdAt: "asc" },
  { id: "asc" },
],
        })
      : [];

    
const inventory = products.map((product) => {
  const productTransactions = transactions.filter(
    (transaction) => transaction.productId === product.id,
  );

  const hasInitialStockTransaction =
  productTransactions.some(
    (transaction) => transaction.type === "INITIAL_STOCK",
  );

  const hasInitialWeightTransaction =
    productTransactions.some(
      (transaction) =>
        transaction.type === "INITIAL_STOCK" &&
        Number(transaction.weight) !== 0,
    );

  // Start with opening stock.
  let stockQuantity = hasInitialStockTransaction
  ? 0
  : Number(product.initialStockQuantity ?? 0);

let stockKg = hasInitialStockTransaction
  ? 0
  : Number(product.initialStockKg ?? 0);

  for (const transaction of productTransactions) {
    const weightKg = Number(transaction.weight) || 0;
    const quantity = Number(transaction.quantity) || 0;

    switch (transaction.type) {
      case "INITIAL_STOCK":
      case "PRODUCTION":
      case "PURCHASE":
      case "STOCK_ADJUSTMENT_ADD":
      case "SALE_VOID":
        stockKg += weightKg;
        stockQuantity += quantity;
        break;

      case "SALE":
      case "PURCHASE_VOID":
      case "PURCHASE_EDIT_REVERSAL":
      case "STOCK_ADJUSTMENT_REMOVE":
      case "PRODUCTION_REVERSAL":
        stockKg -= weightKg;
        stockQuantity -= quantity;
        break;

      default:
        break;
    }

    // Never allow negative stock.
    stockKg = Math.max(0, stockKg);
    stockQuantity = Math.max(0, stockQuantity);
  }

  stockKg =
    Math.round((stockKg + Number.EPSILON) * 1000) / 1000;

  const lowStockThresholdKg = Number(
    product.lowStockThresholdKg,
  );

  return {
    id: product.id,
    name: product.name,
    code: product.code,
    stockQuantity,
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

