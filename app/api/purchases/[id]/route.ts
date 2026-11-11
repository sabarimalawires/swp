
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PurchaseLineInput = {
  productId: string;
  quantity: number | null;
  weight: number;
  rate: number;
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parsePurchaseBody(body: Record<string, unknown>) {
  const supplierId = String(body.supplierId ?? "").trim();
  const invoiceNumber = String(body.invoiceNumber ?? "").trim();
  const dateValue = String(body.purchaseDate ?? "").trim();

  if (!supplierId) throw new Error("Select a supplier.");
  if (invoiceNumber.length > 100) {
    throw new Error("Invoice number must be 100 characters or less.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw new Error("Invalid purchase date.");
  }

  const purchaseDate = new Date(`${dateValue}T00:00:00.000Z`);

  if (
    Number.isNaN(purchaseDate.getTime()) ||
    purchaseDate.toISOString().slice(0, 10) !== dateValue
  ) {
    throw new Error("Invalid purchase date.");
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new Error("Add at least one product.");
  }

  const items: PurchaseLineInput[] = body.items.map((raw) => {
    if (!raw || typeof raw !== "object") {
      throw new Error("Invalid product line.");
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

    const weightText = String(line.weight ?? "");
    const rateText = String(line.rate ?? "");
    const weight = Number(weightText);
    const rate = Number(rateText);

    if (
      !productId ||
      (quantity !== null &&
        (!Number.isSafeInteger(quantity) || quantity <= 0)) ||
      !/^\d+(\.\d{1,3})?$/.test(weightText) ||
      !Number.isFinite(weight) ||
      weight <= 0 ||
      !/^\d+(\.\d{1,6})?$/.test(rateText) ||
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      throw new Error(
        "Each product needs a valid product, optional whole quantity, positive weight and positive rate.",
      );
    }

    return { productId, quantity, weight, rate };
  });

  if (new Set(items.map((item) => item.productId)).size !== items.length) {
    throw new Error("A product can only be selected once per purchase.");
  }

  return {
    supplierId,
    invoiceNumber,
    purchaseDate,
    items,
    lineAmounts: items.map((item) => money(item.weight * item.rate)),
  };
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
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
    const input = parsePurchaseBody(body);

    const totalAmount = money(
      input.lineAmounts.reduce((sum, amount) => sum + amount, 0),
    );

    const updated = await prisma.$transaction(
      async (tx) => {
        const oldPurchase = await tx.purchase.findUnique({
          where: { id },
          include: {
            supplier: { select: { id: true, name: true } },
            items: {
              include: {
                product: { select: { id: true, name: true } },
              },
            },
          },
        });

        if (!oldPurchase) throw new Error("PURCHASE_NOT_FOUND");
        if (oldPurchase.status !== "ACTIVE") {
          throw new Error("PURCHASE_NOT_ACTIVE");
        }

        const supplier = await tx.supplier.findUnique({
          where: { id: input.supplierId },
          select: { id: true, name: true },
        });

        if (!supplier) throw new Error("SUPPLIER_NOT_FOUND");

        const preparedItems = [];

        for (let i = 0; i < input.items.length; i++) {
          const item = input.items[i];
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { id: true, name: true, isActive: true },
          });

          if (!product) throw new Error("PRODUCT_NOT_FOUND");
          if (!product.isActive) throw new Error("PRODUCT_INACTIVE");

          preparedItems.push({
            productId: product.id,
            productName: product.name,
            quantity: item.quantity,
            weight: item.weight,
            rate: item.rate,
            amount: input.lineAmounts[i],
          });
        }

        const oldItemIds = oldPurchase.items.map((item) => item.id);

        // Preserve old inventory history before deleting old purchase items.
        if (oldItemIds.length) {
          await tx.inventoryTransaction.updateMany({
            where: { purchaseItemId: { in: oldItemIds } },
            data: { purchaseItemId: null },
          });
        }

        // Reverse the old purchase stock.
        for (const item of oldPurchase.items) {
          await tx.inventoryTransaction.create({
            data: {
              productId: item.productId,
              type: "PURCHASE_EDIT_REVERSAL",
              quantity: item.quantity ?? 0,
              weight: item.weight,
              referenceType: "PURCHASE_EDIT",
              referenceId: oldPurchase.id,
              createdById: admin.id,
            },
          });
        }

        await tx.purchaseItem.deleteMany({
          where: { purchaseId: id },
        });

        const purchase = await tx.purchase.update({
          where: { id },
          data: {
            supplierId: input.supplierId,
            invoiceNumber: input.invoiceNumber || null,
            purchaseDate: input.purchaseDate,
            totalAmount,
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
            supplier: { select: { id: true, name: true } },
            items: true,
          },
        });

        // Add the updated purchase stock.
        for (const item of purchase.items) {
          await tx.inventoryTransaction.create({
            data: {
              productId: item.productId,
              type: "PURCHASE",
              quantity: item.quantity ?? 0,
              weight: item.weight,
              referenceType: "PURCHASE",
              referenceId: purchase.id,
              createdById: admin.id,
              purchaseItemId: item.id,
            },
          });
        }

        await createAuditLog(
          {
            userId: admin.id,
            action: "UPDATE",
            entityType: "PURCHASE",
            entityId: purchase.id,
            oldValue: {
              supplierId: oldPurchase.supplierId,
              supplierName: oldPurchase.supplier.name,
              invoiceNumber: oldPurchase.invoiceNumber,
              purchaseDate: oldPurchase.purchaseDate,
              totalAmount: Number(oldPurchase.totalAmount),
              items: oldPurchase.items.map((item) => ({
                productId: item.productId,
                productName: item.product.name,
                quantity: item.quantity,
                weight: Number(item.weight),
                rate: Number(item.rate),
                amount: Number(item.amount),
              })),
            },
            newValue: {
              supplierId: supplier.id,
              supplierName: supplier.name,
              invoiceNumber: purchase.invoiceNumber,
              purchaseDate: purchase.purchaseDate,
              totalAmount,
              items: preparedItems,
            },
          },
          tx,
        );

        return purchase;
      },
      { isolationLevel: "Serializable" },
    );

    return NextResponse.json({
      message: "Purchase updated successfully.",
      purchase: updated,
    });
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, { status: number; message: string }> = {
        PURCHASE_NOT_FOUND: { status: 404, message: "Purchase not found." },
        PURCHASE_NOT_ACTIVE: { status: 409, message: "Only active purchases can be edited." },
        SUPPLIER_NOT_FOUND: { status: 404, message: "Supplier not found." },
        PRODUCT_NOT_FOUND: { status: 404, message: "One or more products were not found." },
        PRODUCT_INACTIVE: { status: 409, message: "Inactive products cannot be purchased." },
      };

      const known = messages[error.message];
      if (known) {
        return NextResponse.json(
          { error: known.message },
          { status: known.status },
        );
      }

      if (
        error.message.startsWith("Select ") ||
        error.message.startsWith("Invoice ") ||
        error.message.startsWith("Invalid ") ||
        error.message.startsWith("Add ") ||
        error.message.startsWith("Each ") ||
        error.message.startsWith("A product ")
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error("Purchase update failed:", error);
    return NextResponse.json(
      { error: "Failed to update purchase." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteContext,
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
        const purchase = await tx.purchase.findUnique({
          where: { id },
          include: {
            supplier: { select: { id: true, name: true } },
            items: {
              include: {
                product: { select: { id: true, name: true } },
              },
            },
          },
        });

        if (!purchase) throw new Error("PURCHASE_NOT_FOUND");
        

        const itemIds = purchase.items.map((item) => item.id);

        // Detach old transactions so purchase items can be deleted,
        // while keeping all original inventory history.
        if (itemIds.length) {
          await tx.inventoryTransaction.updateMany({
            where: { purchaseItemId: { in: itemIds } },
            data: { purchaseItemId: null },
          });
        }

        // Reverse every original purchase line.
       // Reverse stock only if the purchase is still ACTIVE.
// A VOIDED purchase has already had its stock reversed.
if (purchase.status === "ACTIVE") {
  for (const item of purchase.items) {
    await tx.inventoryTransaction.create({
      data: {
        productId: item.productId,
        type: "PURCHASE_VOID",
        quantity: item.quantity ?? 0,
        weight: item.weight,
        referenceType: "PURCHASE_VOID",
        referenceId: purchase.id,
        createdById: admin.id,
      },
    });
  }
}

        // Payments remain with the supplier, not the deleted purchase.
        await tx.supplierPayment.updateMany({
          where: { purchaseId: purchase.id },
          data: { purchaseId: null },
        });

        await createAuditLog(
          {
            userId: admin.id,
            action: "DELETE",
            entityType: "PURCHASE",
            entityId: purchase.id,
            oldValue: {
              supplierId: purchase.supplierId,
              supplierName: purchase.supplier.name,
              invoiceNumber: purchase.invoiceNumber,
              purchaseDate: purchase.purchaseDate,
              totalAmount: Number(purchase.totalAmount),
              items: purchase.items.map((item) => ({
                productId: item.productId,
                productName: item.product.name,
                quantity: item.quantity,
                weight: Number(item.weight),
                rate: Number(item.rate),
                amount: Number(item.amount),
              })),
            },
            newValue: null,
          },
          tx,
        );

        await tx.purchase.delete({ where: { id } });

        return {
          purchaseId: id,
          supplierId: purchase.supplierId,
          deletedAmount: Number(purchase.totalAmount),
          reversedItems: purchase.items.length,
        };
      },
      { isolationLevel: "Serializable" },
    );

    return NextResponse.json({
      message: "Purchase deleted successfully. Inventory and supplier balances have been recalculated.",
      ...result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PURCHASE_NOT_FOUND") {
      return NextResponse.json(
        { error: "Purchase not found." },
        { status: 404 },
      );
    }

    if (error instanceof Error && error.message === "PURCHASE_NOT_ACTIVE") {
      return NextResponse.json(
        { error: "This purchase is not active." },
        { status: 409 },
      );
    }

    console.error("Purchase deletion failed:", error);
    return NextResponse.json(
      { error: "Failed to delete purchase." },
      { status: 500 },
    );
  }
}
