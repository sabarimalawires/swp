
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

type SaleLineInput = {
  productId: string;
  quantity: number;
  weight: number;
  rate: number;
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getCurrentStock(
  initialStock: number,
  transactions: { type: string; quantity: number }[],
) {
  let stock = 0;

  if (!transactions.some((t) => t.type === "INITIAL_STOCK")) {
    stock += initialStock;
  }

  for (const transaction of transactions) {
    switch (transaction.type) {
      case "INITIAL_STOCK":
      case "PRODUCTION":
      case "STOCK_ADJUSTMENT_ADD":
      case "SALE_VOID":
        stock += transaction.quantity;
        break;
      case "SALE":
      case "STOCK_ADJUSTMENT_REMOVE":
      case "PRODUCTION_REVERSAL":
        stock -= transaction.quantity;
        break;
    }
  }

  return Math.max(0, stock);
}

function dateFromInput(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();

    const customerId =
      typeof body.customerId === "string" ? body.customerId.trim() : "";
    const saleDate = dateFromInput(body.saleDate);
    const confirmInsufficientStock =
      body.confirmInsufficientStock === true;

    if (!customerId) {
      return NextResponse.json(
        { error: "Select a customer." },
        { status: 400 },
      );
    }

    if (!saleDate) {
      return NextResponse.json(
        { error: "Enter a valid sale date." },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "Add at least one product." },
        { status: 400 },
      );
    }

    const items: SaleLineInput[] = [];
    const seenProducts = new Set<string>();

    for (const raw of body.items) {
      if (
        !raw ||
        typeof raw.productId !== "string" ||
        !raw.productId.trim()
      ) {
        return NextResponse.json(
          { error: "Each item must have a product." },
          { status: 400 },
        );
      }

      const productId = raw.productId.trim();
      const quantity = Number(raw.quantity);
      const weight = Number(raw.weight);
      const rate = Number(raw.rate);

      if (seenProducts.has(productId)) {
        return NextResponse.json(
          { error: "A product can only appear once in a sale." },
          { status: 400 },
        );
      }

      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        return NextResponse.json(
          { error: "Quantity must be a positive whole number." },
          { status: 400 },
        );
      }

      if (
        !Number.isFinite(weight) ||
        weight <= 0 ||
        !/^\d+(\.\d{1,2})?$/.test(String(raw.weight))
      ) {
        return NextResponse.json(
          { error: "Weight must be positive with at most 2 decimal places." },
          { status: 400 },
        );
      }

      if (
        !Number.isFinite(rate) ||
        rate <= 0 ||
        !/^\d+(\.\d{1,2})?$/.test(String(raw.rate))
      ) {
        return NextResponse.json(
          { error: "Rate must be positive with at most 2 decimal places." },
          { status: 400 },
        );
      }

      seenProducts.add(productId);
      items.push({ productId, quantity, weight, rate });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id },
          include: {
            customer: { select: { id: true, name: true } },
            items: {
              select: {
                productId: true,
                productName: true,
                quantity: true,
                weight: true,
                rate: true,
                amount: true,
                deductedQuantity: true,
              },
            },
          },
        });

        if (!sale) throw new Error("SALE_NOT_FOUND");
        if (sale.status === "VOIDED") throw new Error("SALE_ALREADY_VOIDED");
        if (sale.items.length === 0) throw new Error("SALE_ITEMS_MISSING");

        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { id: true, name: true },
        });

        if (!customer) throw new Error("CUSTOMER_NOT_FOUND");

        const productIds = [...new Set(items.map((item) => item.productId))];

        const products = await tx.product.findMany({
          where: { id: { in: productIds }, isActive: true },
          select: { id: true, name: true, initialStock: true },
        });

        if (products.length !== productIds.length) {
          throw new Error("PRODUCT_NOT_FOUND");
        }

        const productById = new Map(products.map((p) => [p.id, p]));
        const stockByProduct = new Map<string, number>();

        for (const product of products) {
          const transactions = await tx.inventoryTransaction.findMany({
            where: { productId: product.id },
            select: { type: true, quantity: true },
          });

          const currentStock = getCurrentStock(
            Number(product.initialStock),
            transactions.map((t) => ({
              type: t.type,
              quantity: Number(t.quantity),
            })),
          );

          const oldDeduction = sale.items
            .filter((item) => item.productId === product.id)
            .reduce((sum, item) => sum + item.deductedQuantity, 0);

          stockByProduct.set(product.id, currentStock + oldDeduction);
        }

        // Reverse only the inventory actually deducted by the old sale.
        for (const oldItem of sale.items) {
          if (oldItem.deductedQuantity <= 0) continue;

          await tx.inventoryTransaction.create({
            data: {
              productId: oldItem.productId,
              type: "SALE_VOID",
              quantity: oldItem.deductedQuantity,
              referenceType: "SALE_VOID",
              referenceId: sale.id,
              createdById: admin.id,
              saleId: sale.id,
            },
          });
        }

        const shortages: {
          productId: string;
          productName: string;
          requested: number;
          available: number;
        }[] = [];

        const preparedItems = items.map((item) => {
          const product = productById.get(item.productId)!;
          const available = stockByProduct.get(item.productId) ?? 0;

          if (item.quantity > available) {
            shortages.push({
              productId: item.productId,
              productName: product.name,
              requested: item.quantity,
              available,
            });
          }

          return {
            ...item,
            productName: product.name,
            amount: money(item.weight * item.rate),
            deductedQuantity: Math.min(item.quantity, available),
          };
        });

        // Throwing rolls back all changes in this transaction.
        if (shortages.length > 0 && !confirmInsufficientStock) {
          throw new Error(`INSUFFICIENT_STOCK:${JSON.stringify(shortages)}`);
        }

        for (const item of preparedItems) {
          if (item.deductedQuantity <= 0) continue;

          await tx.inventoryTransaction.create({
            data: {
              productId: item.productId,
              type: "SALE",
              quantity: item.deductedQuantity,
              referenceType: "SALE",
              referenceId: sale.id,
              createdById: admin.id,
              saleId: sale.id,
            },
          });
        }

        const totalQuantity = preparedItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        );
        const totalWeight = preparedItems.reduce(
          (sum, item) => sum + item.weight,
          0,
        );
        const totalAmount = money(
          preparedItems.reduce((sum, item) => sum + item.amount, 0),
        );

        await tx.saleItem.deleteMany({ where: { saleId: sale.id } });

        const updatedSale = await tx.sale.update({
          where: { id: sale.id },
          data: {
            customerId,
            saleDate,
            productId: preparedItems[0].productId,
            quantity: totalQuantity,
            weight: totalWeight,
            amount: totalAmount,
            items: {
              create: preparedItems.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                weight: item.weight,
                rate: item.rate,
                amount: item.amount,
                deductedQuantity: item.deductedQuantity,
              })),
            },
          },
          include: {
            customer: { select: { id: true, name: true } },
            items: { orderBy: { productName: "asc" } },
          },
        });

        await createAuditLog(
          {
            userId: admin.id,
            action: "UPDATE",
            entityType: "SALE",
            entityId: sale.id,
            oldValue: {
              customerId: sale.customerId,
              customerName: sale.customer.name,
              saleDate: sale.saleDate,
              amount: Number(sale.amount),
              status: sale.status,
              items: sale.items.map((item) => ({
                ...item,
                weight: Number(item.weight),
                rate: Number(item.rate),
                amount: Number(item.amount),
              })),
            },
            newValue: {
              customerId,
              customerName: customer.name,
              saleDate,
              amount: totalAmount,
              status: updatedSale.status,
              items: preparedItems,
            },
          },
          tx,
        );

        return updatedSale;
      },
      { isolationLevel: "Serializable" },
    );

    return NextResponse.json({
      message: "Sale updated successfully.",
      sale: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SALE_NOT_FOUND") {
        return NextResponse.json({ error: "Sale not found." }, { status: 404 });
      }

      if (error.message === "SALE_ALREADY_VOIDED") {
        return NextResponse.json(
          { error: "Voided sales cannot be edited." },
          { status: 409 },
        );
      }

      if (error.message === "SALE_ITEMS_MISSING") {
        return NextResponse.json(
          { error: "Sale items are missing; the sale was not changed." },
          { status: 409 },
        );
      }

      if (error.message === "CUSTOMER_NOT_FOUND") {
        return NextResponse.json(
          { error: "Customer not found." },
          { status: 400 },
        );
      }

      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          { error: "One or more products are unavailable." },
          { status: 400 },
        );
      }

      if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
        const shortages = JSON.parse(
          error.message.slice("INSUFFICIENT_STOCK:".length),
        );

        return NextResponse.json(
          {
            error: "Insufficient stock for one or more products.",
            requiresConfirmation: true,
            shortages,
          },
          { status: 409 },
        );
      }
    }

    console.error("Sale update failed:", error);
    return NextResponse.json(
      { error: "Failed to update sale." },
      { status: 500 },
    );
  }
}
