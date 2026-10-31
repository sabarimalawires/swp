
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";


type SalesUnit = "KGS" | "SQ_FT" | "R_FT" | "R_MTR";
function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getCurrentStock(
  initialStockKg: number,
  transactions: { type: string; weight: number }[],
) {
  let stockKg = 0;

  if (!transactions.some((t) => t.type === "INITIAL_STOCK")) {
    stockKg += initialStockKg;
  }

  for (const transaction of transactions) {
    switch (transaction.type) {
      case "INITIAL_STOCK":
      case "PRODUCTION":
      case "STOCK_ADJUSTMENT_ADD":
      case "SALE_VOID":
        stockKg += transaction.weight;
        break;

      case "SALE":
      case "STOCK_ADJUSTMENT_REMOVE":
      case "PRODUCTION_REVERSAL":
        stockKg -= transaction.weight;
        break;
    }
  }

  return stockKg;
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

type SaleLineInput = {
  productId: string;
  quantity: number;
  salesMeasurement: number;
  salesUnit: SalesUnit;
  inventoryDeductionKg: number;
  rate: number;
};

function isPositiveDecimal(value: unknown, maxDecimals: number) {
  const text = String(value);
  const pattern = new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`);
  const number = Number(value);

  return Number.isFinite(number) && number > 0 && pattern.test(text);
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

    const validUnits: SalesUnit[] = ["KGS", "SQ_FT", "R_FT", "R_MTR"];
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
      const salesUnit: SalesUnit = raw.salesUnit ?? "KGS";

      // Backward compatibility: old requests used weight.
      const salesMeasurement = Number(
        raw.salesMeasurement ?? raw.weight,
      );

      const rate = Number(raw.rate);

      const inventoryDeductionKg = Number(
  salesUnit === "KGS"
    ? salesMeasurement
    : raw.inventoryDeductionKg,
);

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

      if (!validUnits.includes(salesUnit)) {
        return NextResponse.json(
          { error: "Select a valid sales unit." },
          { status: 400 },
        );
      }

      if (!isPositiveDecimal(salesMeasurement, 3)) {
        return NextResponse.json(
          {
            error:
              "Sales measurement must be positive with at most 3 decimal places.",
          },
          { status: 400 },
        );
      }

      if (!isPositiveDecimal(rate, 2)) {
        return NextResponse.json(
          {
            error:
              "Rate must be positive with at most 2 decimal places.",
          },
          { status: 400 },
        );
      }

      if (!isPositiveDecimal(inventoryDeductionKg, 3)) {
        return NextResponse.json(
          {
            error:
              "Inventory deduction must be positive with at most 3 decimal places.",
          },
          { status: 400 },
        );
      }

      seenProducts.add(productId);

      items.push({
        productId,
        quantity,
        salesMeasurement,
        salesUnit,
        inventoryDeductionKg,
        rate,
      });
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
                salesMeasurement: true,
                salesUnit: true,
                rate: true,
                amount: true,
                deductedQuantity: true,
                deductedWeight: true,
              },
            },
          },
        });

        if (!sale) throw new Error("SALE_NOT_FOUND");

        if (sale.status === "VOIDED") {
          throw new Error("SALE_ALREADY_VOIDED");
        }

        if (sale.items.length === 0) {
          throw new Error("SALE_ITEMS_MISSING");
        }

        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { id: true, name: true },
        });

        if (!customer) throw new Error("CUSTOMER_NOT_FOUND");

        const productIds = [...new Set(items.map((item) => item.productId))];

        const products = await tx.product.findMany({
          where: { id: { in: productIds }, isActive: true },
          select: {
            id: true,
            name: true,
            initialStockKg: true,
          },
        });

        if (products.length !== productIds.length) {
          throw new Error("PRODUCT_NOT_FOUND");
        }

        const productById = new Map(products.map((p) => [p.id, p]));
        const stockByProduct = new Map<string, number>();

        for (const product of products) {
          const transactions = await tx.inventoryTransaction.findMany({
            where: { productId: product.id },
            select: { type: true, weight: true },
          });

          const currentStock = getCurrentStock(
            Number(product.initialStockKg),
            transactions.map((t) => ({
              type: t.type,
              weight: Number(t.weight),
            })),
          );

          // Restore this sale's previous inventory deduction for validation.
          const oldDeduction = sale.items
            .filter((item) => item.productId === product.id)
            .reduce(
              (sum, item) =>
                sum +
                Number(item.deductedWeight ?? item.weight ?? 0),
              0,
            );

          stockByProduct.set(
            product.id,
            currentStock + oldDeduction,
          );
        }

        // Reverse the previous sale's inventory deductions.
        for (const oldItem of sale.items) {
          const oldDeductedWeight = Number(
            oldItem.deductedWeight ?? oldItem.weight ?? 0,
          );

          if (oldDeductedWeight <= 0) continue;

          await tx.inventoryTransaction.create({
            data: {
              productId: oldItem.productId,
              type: "SALE_VOID",
              quantity: 0,
              weight: oldDeductedWeight,
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

          if (item.inventoryDeductionKg > available) {
            shortages.push({
              productId: item.productId,
              productName: product.name,
              requested: item.inventoryDeductionKg,
              available,
            });
          }

          return {
            ...item,
            productName: product.name,
            weight: item.inventoryDeductionKg,
            amount: money(item.salesMeasurement * item.rate),
            deductedQuantity: 0,
            deductedWeight: item.inventoryDeductionKg,
          };
        });

        if (shortages.length > 0 && !confirmInsufficientStock) {
          throw new Error(
            `INSUFFICIENT_STOCK:${JSON.stringify(shortages)}`,
          );
        }

        // Record new inventory deductions in kilograms.
        for (const item of preparedItems) {
          await tx.inventoryTransaction.create({
            data: {
              productId: item.productId,
              type: "SALE",
              quantity: 0,
              weight: item.deductedWeight,
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
          preparedItems.reduce(
            (sum, item) => sum + item.amount,
            0,
          ),
        );

        await tx.saleItem.deleteMany({
          where: { saleId: sale.id },
        });

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
                salesMeasurement: item.salesMeasurement,
                salesUnit: item.salesUnit,
                rate: item.rate,
                amount: item.amount,
                deductedQuantity: item.deductedQuantity,
                deductedWeight: item.deductedWeight,
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
                salesMeasurement: Number(item.salesMeasurement),
                rate: Number(item.rate),
                amount: Number(item.amount),
                deductedWeight: Number(
                  item.deductedWeight ?? item.weight ?? 0,
                ),
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
        return NextResponse.json(
          { error: "Sale not found." },
          { status: 404 },
        );
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


export async function DELETE(
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

    const result = await prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id },
          include: {
            customer: { select: { id: true, name: true } },
            items: true,
            payments: {
              select: { id: true, amount: true },
            },
          },
        });

        if (!sale) throw new Error("SALE_NOT_FOUND");

        // Preserve the original sale details for the audit record.
        const oldValue = {
          customerId: sale.customerId,
          customerName: sale.customer.name,
          amount: Number(sale.amount),
          saleDate: sale.saleDate,
          status: sale.status,
          items: sale.items.map((item) => ({
  productId: item.productId,
  productName: item.productName,
  quantity: item.quantity,
  weight: Number(item.weight),
  salesMeasurement: Number(item.salesMeasurement ?? item.weight),
  salesUnit: item.salesUnit ?? "KGS",
  rate: Number(item.rate),
  amount: Number(item.amount),
  deductedQuantity: item.deductedQuantity,
  deductedWeight: Number(item.deductedWeight ?? item.weight),
})),
          linkedPayments: sale.payments.map((payment) => ({
            id: payment.id,
            amount: Number(payment.amount),
          })),
        };

        if (sale.status === "ACTIVE") {
          // Restore the weight deducted by the current sale version.
          const deductedByProduct = new Map<string, number>();

          for (const item of sale.items) {
            const deductedWeight = Number(item.deductedWeight ?? 0);

            deductedByProduct.set(
              item.productId,
              (deductedByProduct.get(item.productId) ?? 0) +
                deductedWeight,
            );
          }

          for (const [productId, deductedWeight] of deductedByProduct) {
            if (deductedWeight <= 0) continue;

            await tx.inventoryTransaction.create({
              data: {
                productId,
                type: "SALE_VOID",
                quantity: 0,
                weight: deductedWeight,
                referenceType: "SALE_VOID",
                referenceId: sale.id,
                createdById: admin.id,
                saleId: sale.id,
              },
            });
          }
        }

        // Preserve inventory history while removing the sale relationship.
        await tx.inventoryTransaction.updateMany({
          where: { saleId: sale.id },
          data: { saleId: null },
        });

        // Remove child items before deleting the sale.
        await tx.saleItem.deleteMany({
          where: { saleId: sale.id },
        });

        // Do not delete sales that still have linked payment records.
        const linkedPayments = await tx.customerPayment.count({
          where: { saleId: sale.id },
        });

        if (linkedPayments > 0) {
          throw new Error("SALE_HAS_LINKED_PAYMENTS");
        }

        await tx.sale.delete({
          where: { id: sale.id },
        });

        await createAuditLog(
          {
            userId: admin.id,
            action: "DELETE",
            entityType: "SALE",
            entityId: sale.id,
            oldValue,
            newValue: {
  deleted: true,
  deletedById: admin.id,
  deletedAt: new Date().toISOString(),
},
          },
          tx,
        );

        const customerSales = await tx.sale.findMany({
          where: {
            customerId: sale.customerId,
            status: "ACTIVE",
          },
          select: { amount: true },
        });

        const customerPayments = await tx.customerPayment.findMany({
          where: { customerId: sale.customerId },
          select: { amount: true },
        });

        const totalPurchases = customerSales.reduce(
          (sum, item) => sum + Number(item.amount),
          0,
        );

        const totalPaid = customerPayments.reduce(
          (sum, payment) => sum + Number(payment.amount),
          0,
        );

        return {
          deletedSaleId: sale.id,
          customerId: sale.customerId,
          totalPurchases,
          totalPaid,
          pendingBalance: Math.max(0, totalPurchases - totalPaid),
        };
      },
      { isolationLevel: "Serializable" },
    );

    return NextResponse.json({
      message: "Sale deleted successfully.",
      ...result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SALE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Sale not found." },
        { status: 404 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "SALE_HAS_LINKED_PAYMENTS"
    ) {
      return NextResponse.json(
        {
          error:
            "This sale has linked payments. Handle those payments before deleting the sale.",
        },
        { status: 409 },
      );
    }

    console.error("Sale deletion failed:", error);

    return NextResponse.json(
      {
        error:
          "Failed to delete sale. Related records may prevent deletion.",
      },
      { status: 500 },
    );
  }
}
