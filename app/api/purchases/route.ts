
import { NextResponse } from "next/server";

import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

type PurchaseLineInput = {
  productId: string;
  quantity: number | null;
  weight: number;
  rate: number;
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isValidDecimal(value: unknown, maxDecimals: number) {
  const number = Number(value);
  const pattern = new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`);

  return (
    Number.isFinite(number) &&
    number > 0 &&
    pattern.test(String(value))
  );
}

export async function GET(request: Request) {
  try {
    const employee = await requireAdmin(request);

    if (!employee) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const purchases = await prisma.purchase.findMany({
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
          orderBy: { product: { name: "asc" } },
        },
        payments: true,
        createdBy: {
          select: { name: true, username: true },
        },
      },
      orderBy: { purchaseDate: "desc" },
      take: 100,
    });

    return NextResponse.json(
      purchases.map((purchase) => ({
        ...purchase,
        totalAmount: Number(purchase.totalAmount),
        items: purchase.items.map((item) => ({
          ...item,
          weight: Number(item.weight),
          rate: Number(item.rate),
          amount: Number(item.amount),
        })),
        payments: purchase.payments.map((payment) => ({
          ...payment,
          amount: Number(payment.amount),
        })),
      })),
    );
  } catch (error) {
    console.error("Purchase lookup failed:", error);
    return NextResponse.json(
      { error: "Failed to load purchases." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const employee = await requireAdmin(request);

    if (!employee) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const body = await request.json();

    const supplierId = String(body.supplierId ?? "").trim();
    const purchaseDateValue = String(body.purchaseDate ?? "").trim();
    const invoiceNumber = String(body.invoiceNumber ?? "").trim();

    if (!supplierId) {
      return NextResponse.json(
        { error: "Select a supplier." },
        { status: 400 },
      );
    }

    if (invoiceNumber.length > 100) {
      return NextResponse.json(
        { error: "Invoice number must be 100 characters or less." },
        { status: 400 },
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDateValue)) {
      return NextResponse.json(
        { error: "Invalid purchase date." },
        { status: 400 },
      );
    }

    const purchaseDate = new Date(`${purchaseDateValue}T00:00:00.000Z`);

    if (
      Number.isNaN(purchaseDate.getTime()) ||
      purchaseDate.toISOString().slice(0, 10) !== purchaseDateValue
    ) {
      return NextResponse.json(
        { error: "Invalid purchase date." },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "Add at least one product." },
        { status: 400 },
      );
    }

    const items: PurchaseLineInput[] = [];

    for (const raw of body.items as unknown[]) {
      if (!raw || typeof raw !== "object") {
        return NextResponse.json(
          { error: "Invalid product line." },
          { status: 400 },
        );
      }

      const line = raw as Record<string, unknown>;
      const productId = String(line.productId ?? "").trim();

      const quantityValue = line.quantity;
      const quantity =
        quantityValue === null ||
        quantityValue === undefined ||
        quantityValue === ""
          ? null
          : Number(quantityValue);

      const weight = Number(line.weight);
      const rate = Number(line.rate);

      if (
        !productId ||
        (quantity !== null &&
          (!Number.isSafeInteger(quantity) || quantity <= 0)) ||
        !isValidDecimal(line.weight, 3) ||
        !isValidDecimal(line.rate, 6)
      ) {
        return NextResponse.json(
          {
            error:
              "Each product needs a valid product, optional whole piece quantity, positive weight, and positive rate.",
          },
          { status: 400 },
        );
      }

      items.push({ productId, quantity, weight, rate });
    }

    if (
      new Set(items.map((item) => item.productId)).size !== items.length
    ) {
      return NextResponse.json(
        { error: "A product can only be selected once per purchase." },
        { status: 400 },
      );
    }

    const lineAmounts = items.map((item) =>
      money(item.weight * item.rate),
    );

    const totalAmount = money(
      lineAmounts.reduce((sum, amount) => sum + amount, 0),
    );

    const runTransaction = () =>
      prisma.$transaction(
        async (tx) => {
          const supplier = await tx.supplier.findUnique({
            where: { id: supplierId },
            select: { id: true, name: true },
          });

          if (!supplier) {
            throw new Error("SUPPLIER_NOT_FOUND");
          }

          const preparedItems = [];

          for (let index = 0; index < items.length; index++) {
            const item = items[index];

            const product = await tx.product.findUnique({
              where: { id: item.productId },
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            });

            if (!product) {
              throw new Error("PRODUCT_NOT_FOUND");
            }

            if (!product.isActive) {
              throw new Error("PRODUCT_INACTIVE");
            }

            preparedItems.push({
              productId: product.id,
              productName: product.name,
              quantity: item.quantity,
              weight: item.weight,
              rate: item.rate,
              amount: lineAmounts[index],
            });
          }

          const purchase = await tx.purchase.create({
            data: {
              supplierId,
              invoiceNumber: invoiceNumber || null,
              purchaseDate,
              totalAmount,
              status: "ACTIVE",
              createdById: employee.id,
              items: {
                create: preparedItems.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  weight: item.weight,
                  rate: item.rate,
                  amount: item.amount,
                })),
              },
            },
            include: {
              items: true,
              supplier: {
                select: { id: true, name: true },
              },
            },
          });

          for (let index = 0; index < purchase.items.length; index++) {
            const item = purchase.items[index];

            await tx.inventoryTransaction.create({
              data: {
                productId: item.productId,
                type: "PURCHASE",
                quantity: item.quantity ?? 0,
                weight: item.weight,
                referenceType: "PURCHASE",
                referenceId: purchase.id,
                createdById: employee.id,
                purchaseItemId: item.id,
              },
            });
          }

          await createAuditLog(
            {
              userId: employee.id,
              action: "CREATE",
              entityType: "PURCHASE",
              entityId: purchase.id,
              oldValue: null,
              newValue: {
                supplierId: supplier.id,
                supplierName: supplier.name,
                invoiceNumber: purchase.invoiceNumber,
                items: preparedItems,
                totalAmount,
                purchaseDate,
                status: "ACTIVE",
              },
            },
            tx,
          );

          return {
            ...purchase,
            totalAmount: Number(purchase.totalAmount),
            items: purchase.items.map((item) => ({
              ...item,
              weight: Number(item.weight),
              rate: Number(item.rate),
              amount: Number(item.amount),
            })),
          };
        },
        { isolationLevel: "Serializable" },
      );

    let purchase;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        purchase = await runTransaction();
        break;
      } catch (error) {
        const isConflict =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2034";

        if (isConflict && attempt < 3) continue;
        throw error;
      }
    }

    return NextResponse.json(
      { message: "Purchase created successfully.", purchase },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SUPPLIER_NOT_FOUND") {
        return NextResponse.json(
          { error: "Supplier not found." },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          { error: "One or more products were not found." },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_INACTIVE") {
        return NextResponse.json(
          { error: "Inactive products cannot be purchased." },
          { status: 409 },
        );
      }
    }

    console.error("Purchase creation failed:", error);

    return NextResponse.json(
      { error: "Failed to create purchase." },
      { status: 500 },
    );
  }
}
