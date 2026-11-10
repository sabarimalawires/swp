
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function calculateBalance(totalPurchases: number, totalPaid: number) {
  const netBalance = totalPurchases - totalPaid;

  return {
    netBalance,
    pendingBalance: Math.max(0, netBalance),
    supplierCredit: Math.max(0, -netBalance),
  };
}

function validatePayment(body: Record<string, unknown>) {
  const amount = Number(body.amount);
  const paymentDateValue = String(body.paymentDate ?? "").trim();
  const note =
    body.note === undefined || body.note === null
      ? null
      : String(body.note).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDateValue)) {
    return { error: "A valid payment date is required." };
  }

  const paymentDate = new Date(`${paymentDateValue}T00:00:00.000Z`);

  if (
    Number.isNaN(paymentDate.getTime()) ||
    paymentDate.toISOString().slice(0, 10) !== paymentDateValue
  ) {
    return { error: "Invalid payment date." };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Payment amount must be greater than ₹0." };
  }

  if (note && note.length > 500) {
    return { error: "Payment note must be 500 characters or less." };
  }

  return { amount, paymentDate, note };
}

export async function POST(
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

    const { id: supplierId } = await params;
    const body = await request.json();
    const validated = validatePayment(body);

    if ("error" in validated) {
      return NextResponse.json(
        { error: validated.error },
        { status: 400 },
      );
    }

    const { amount, paymentDate, note } = validated;

    const result = await prisma.$transaction(
      async (tx) => {
        const supplier = await tx.supplier.findUnique({
          where: { id: supplierId },
          select: {
            id: true,
            name: true,
            purchases: {
              where: { status: "ACTIVE" },
              select: { totalAmount: true },
            },
            payments: {
              select: { amount: true },
            },
          },
        });

        if (!supplier) {
          throw new Error("SUPPLIER_NOT_FOUND");
        }

        const totalPurchases = supplier.purchases.reduce(
          (total, purchase) => total + Number(purchase.totalAmount),
          0,
        );

        const totalPaid = supplier.payments.reduce(
          (total, payment) => total + Number(payment.amount),
          0,
        );

        const payment = await tx.supplierPayment.create({
          data: {
            supplierId,
            amount,
            paymentDate,
            note,
            createdById: admin.id,
          },
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            note: true,
            createdBy: {
              select: {
                name: true,
                username: true,
              },
            },
          },
        });

        const balance = calculateBalance(
          totalPurchases,
          totalPaid + amount,
        );

        await createAuditLog(
          {
            userId: admin.id,
            action: "CREATE",
            entityType: "SUPPLIER_PAYMENT",
            entityId: payment.id,
            oldValue: null,
            newValue: {
              supplierId,
              supplierName: supplier.name,
              amount,
              note,
              paymentDate: payment.paymentDate,
            },
          },
          tx,
        );

        return {
          payment,
          totalPurchases,
          totalPaid: totalPaid + amount,
          pendingBalance: balance.pendingBalance,
          supplierCredit: balance.supplierCredit,
          netBalance: balance.netBalance,
        };
      },
      { isolationLevel: "Serializable" },
    );

    return NextResponse.json(
      {
        message: "Supplier payment recorded successfully.",
        ...result,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "SUPPLIER_NOT_FOUND") {
      return NextResponse.json(
        { error: "Supplier not found." },
        { status: 404 },
      );
    }

    console.error("Supplier payment creation failed:", error);

    return NextResponse.json(
      { error: "Failed to record supplier payment." },
      { status: 500 },
    );
  }
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

    const { id: supplierId } = await params;
    const body = await request.json();

    const paymentId = String(body.paymentId ?? "").trim();

    if (!paymentId) {
      return NextResponse.json(
        { error: "Payment ID is required." },
        { status: 400 },
      );
    }

    const validated = validatePayment(body);

    if ("error" in validated) {
      return NextResponse.json(
        { error: validated.error },
        { status: 400 },
      );
    }

    const { amount, paymentDate, note } = validated;

    const result = await prisma.$transaction(
      async (tx) => {
        const payment = await tx.supplierPayment.findFirst({
          where: { id: paymentId, supplierId },
          select: {
            id: true,
            supplierId: true,
            amount: true,
            note: true,
            paymentDate: true,
          },
        });

        if (!payment) {
          throw new Error("PAYMENT_NOT_FOUND");
        }

        const supplier = await tx.supplier.findUnique({
          where: { id: supplierId },
          select: {
            id: true,
            name: true,
            purchases: {
              where: { status: "ACTIVE" },
              select: { totalAmount: true },
            },
            payments: {
              select: {
                id: true,
                amount: true,
              },
            },
          },
        });

        if (!supplier) {
          throw new Error("SUPPLIER_NOT_FOUND");
        }

        const totalPurchases = supplier.purchases.reduce(
          (total, purchase) => total + Number(purchase.totalAmount),
          0,
        );

        const totalPaidWithoutCurrent = supplier.payments.reduce(
          (total, currentPayment) =>
            currentPayment.id === payment.id
              ? total
              : total + Number(currentPayment.amount),
          0,
        );

        // Overpayments are allowed.
        const newTotalPaid = totalPaidWithoutCurrent + amount;

        const updatedPayment = await tx.supplierPayment.update({
          where: { id: payment.id },
          data: { amount, paymentDate, note },
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            note: true,
            createdBy: {
              select: {
                name: true,
                username: true,
              },
            },
          },
        });

        await createAuditLog(
          {
            userId: admin.id,
            action: "UPDATE",
            entityType: "SUPPLIER_PAYMENT",
            entityId: payment.id,
            oldValue: {
              supplierId,
              supplierName: supplier.name,
              amount: Number(payment.amount),
              note: payment.note,
              paymentDate: payment.paymentDate,
            },
            newValue: {
              supplierId,
              supplierName: supplier.name,
              amount,
              note,
              paymentDate: updatedPayment.paymentDate,
            },
          },
          tx,
        );

        const balance = calculateBalance(
          totalPurchases,
          newTotalPaid,
        );

        return {
          payment: updatedPayment,
          totalPurchases,
          totalPaid: newTotalPaid,
          pendingBalance: balance.pendingBalance,
          supplierCredit: balance.supplierCredit,
          netBalance: balance.netBalance,
        };
      },
      { isolationLevel: "Serializable" },
    );

    return NextResponse.json({
      message: "Supplier payment updated successfully.",
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PAYMENT_NOT_FOUND") {
        return NextResponse.json(
          { error: "Payment not found for this supplier." },
          { status: 404 },
        );
      }

      if (error.message === "SUPPLIER_NOT_FOUND") {
        return NextResponse.json(
          { error: "Supplier not found." },
          { status: 404 },
        );
      }
    }

    console.error("Supplier payment update failed:", error);

    return NextResponse.json(
      { error: "Failed to update supplier payment." },
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

    const { id: supplierId } = await params;
    const url = new URL(request.url);
    const paymentId = (url.searchParams.get("paymentId") ?? "").trim();

    if (!paymentId) {
      return NextResponse.json(
        { error: "Payment ID is required." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const payment = await tx.supplierPayment.findFirst({
          where: { id: paymentId, supplierId },
          select: {
            id: true,
            supplierId: true,
            amount: true,
            note: true,
            paymentDate: true,
          },
        });

        if (!payment) {
          throw new Error("PAYMENT_NOT_FOUND");
        }

        const supplier = await tx.supplier.findUnique({
          where: { id: supplierId },
          select: {
            id: true,
            name: true,
            purchases: {
              where: { status: "ACTIVE" },
              select: { totalAmount: true },
            },
            payments: {
              select: { amount: true },
            },
          },
        });

        if (!supplier) {
          throw new Error("SUPPLIER_NOT_FOUND");
        }

        const totalPurchases = supplier.purchases.reduce(
          (total, purchase) => total + Number(purchase.totalAmount),
          0,
        );

        const totalPaidBefore = supplier.payments.reduce(
          (total, currentPayment) => total + Number(currentPayment.amount),
          0,
        );

        await tx.supplierPayment.delete({
          where: { id: payment.id },
        });

        const totalPaid = totalPaidBefore - Number(payment.amount);

        const balance = calculateBalance(totalPurchases, totalPaid);

        await createAuditLog(
          {
            userId: admin.id,
            action: "DELETE",
            entityType: "SUPPLIER_PAYMENT",
            entityId: payment.id,
            oldValue: {
              supplierId,
              supplierName: supplier.name,
              amount: Number(payment.amount),
              note: payment.note,
              paymentDate: payment.paymentDate,
            },
            newValue: null,
          },
          tx,
        );

        return {
          paymentId: payment.id,
          totalPurchases,
          totalPaid,
          pendingBalance: balance.pendingBalance,
          supplierCredit: balance.supplierCredit,
          netBalance: balance.netBalance,
        };
      },
      { isolationLevel: "Serializable" },
    );

    return NextResponse.json({
      message: "Supplier payment deleted successfully.",
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PAYMENT_NOT_FOUND") {
        return NextResponse.json(
          { error: "Payment not found for this supplier." },
          { status: 404 },
        );
      }

      if (error.message === "SUPPLIER_NOT_FOUND") {
        return NextResponse.json(
          { error: "Supplier not found." },
          { status: 404 },
        );
      }
    }

    console.error("Supplier payment deletion failed:", error);

    return NextResponse.json(
      { error: "Failed to delete supplier payment." },
      { status: 500 },
    );
  }
}
