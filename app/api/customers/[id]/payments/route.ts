import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function calculateBalance(
  totalPurchases: number,
  totalPaid: number
) {
  const netBalance = totalPurchases - totalPaid;

  return {
    netBalance,
    pendingBalance: Math.max(0, netBalance),
    customerCredit: Math.max(0, -netBalance),
  };
}

/*
 * ============================================================
 * ADD CUSTOMER PAYMENT
 * ============================================================
 */
export async function POST(
  request: Request,
  { params }: RouteContext
) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const { id: customerId } = await params;
    const body = await request.json();

    const amount = Number(body.amount);
    const paymentDateValue = String(
      body.paymentDate ?? ""
    ).trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDateValue)) {
      return NextResponse.json(
        { error: "A valid payment date is required." },
        { status: 400 }
      );
    }

    const paymentDate = new Date(
      `${paymentDateValue}T00:00:00.000Z`
    );

    if (
      Number.isNaN(paymentDate.getTime()) ||
      paymentDate.toISOString().slice(0, 10) !==
        paymentDateValue
    ) {
      return NextResponse.json(
        { error: "Invalid payment date." },
        { status: 400 }
      );
    }

    const note =
      body.note === undefined || body.note === null
        ? null
        : String(body.note).trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          error: "Payment amount must be greater than ₹0.",
        },
        { status: 400 }
      );
    }

    if (note && note.length > 500) {
      return NextResponse.json(
        {
          error:
            "Payment note must be 500 characters or less.",
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: {
            id: true,
            name: true,
            sales: {
              where: { status: "ACTIVE" },
              select: { amount: true },
            },
            payments: {
              select: { amount: true },
            },
          },
        });

        if (!customer) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }

        const totalPurchases = customer.sales.reduce(
          (total, sale) => total + Number(sale.amount),
          0
        );

        const totalPaid = customer.payments.reduce(
          (total, payment) =>
            total + Number(payment.amount),
          0
        );

        const payment = await tx.customerPayment.create({
          data: {
            customerId,
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

        const newTotalPaid = totalPaid + amount;

        const balance = calculateBalance(
          totalPurchases,
          newTotalPaid
        );

        await createAuditLog(
          {
            userId: admin.id,
            action: "CREATE",
            entityType: "CUSTOMER_PAYMENT",
            entityId: payment.id,
            oldValue: null,
            newValue: {
              customerId,
              customerName: customer.name,
              amount,
              note,
              paymentDate: payment.paymentDate,
            },
          },
          tx
        );

        return {
          payment,
          totalPurchases,
          totalPaid: newTotalPaid,
          remainingBalance: balance.pendingBalance,
          pendingBalance: balance.pendingBalance,
          customerCredit: balance.customerCredit,
          netBalance: balance.netBalance,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );

    return NextResponse.json(
      {
        message: "Payment recorded successfully.",
        ...result,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "CUSTOMER_NOT_FOUND"
    ) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }

    console.error(
      "Customer payment creation failed:",
      error
    );

    return NextResponse.json(
      { error: "Failed to record payment." },
      { status: 500 }
    );
  }
}

/*
 * ============================================================
 * EDIT CUSTOMER PAYMENT
 * ============================================================
 */
export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const { id: customerId } = await params;
    const body = await request.json();

    const paymentId = String(
      body.paymentId ?? ""
    ).trim();

    const amount = Number(body.amount);
    const paymentDateValue = String(
      body.paymentDate ?? ""
    ).trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDateValue)) {
      return NextResponse.json(
        { error: "A valid payment date is required." },
        { status: 400 }
      );
    }

    const paymentDate = new Date(
      `${paymentDateValue}T00:00:00.000Z`
    );

    if (
      Number.isNaN(paymentDate.getTime()) ||
      paymentDate.toISOString().slice(0, 10) !==
        paymentDateValue
    ) {
      return NextResponse.json(
        { error: "Invalid payment date." },
        { status: 400 }
      );
    }

    const note =
      body.note === undefined || body.note === null
        ? null
        : String(body.note).trim();

    if (!paymentId) {
      return NextResponse.json(
        { error: "Payment ID is required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          error: "Payment amount must be greater than ₹0.",
        },
        { status: 400 }
      );
    }

    if (note && note.length > 500) {
      return NextResponse.json(
        {
          error:
            "Payment note must be 500 characters or less.",
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const payment =
          await tx.customerPayment.findFirst({
            where: {
              id: paymentId,
              customerId,
            },
            select: {
              id: true,
              customerId: true,
              amount: true,
              note: true,
              paymentDate: true,
            },
          });

        if (!payment) {
          throw new Error("PAYMENT_NOT_FOUND");
        }

        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: {
            id: true,
            name: true,
            sales: {
              where: { status: "ACTIVE" },
              select: { amount: true },
            },
            payments: {
              select: {
                id: true,
                amount: true,
              },
            },
          },
        });

        if (!customer) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }

        const totalPurchases = customer.sales.reduce(
          (total, sale) => total + Number(sale.amount),
          0
        );

        const totalPaidWithoutCurrent =
          customer.payments.reduce(
            (total, currentPayment) => {
              if (currentPayment.id === payment.id) {
                return total;
              }

              return (
                total + Number(currentPayment.amount)
              );
            },
            0
          );

        // Overpayments are allowed.
        const newTotalPaid =
          totalPaidWithoutCurrent + amount;

        const updatedPayment =
          await tx.customerPayment.update({
            where: { id: payment.id },
            data: {
              amount,
              paymentDate,
              note,
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

        await createAuditLog(
          {
            userId: admin.id,
            action: "UPDATE",
            entityType: "CUSTOMER_PAYMENT",
            entityId: payment.id,
            oldValue: {
              customerId,
              customerName: customer.name,
              amount: Number(payment.amount),
              note: payment.note,
              paymentDate: payment.paymentDate,
            },
            newValue: {
              customerId,
              customerName: customer.name,
              amount,
              note,
              paymentDate: updatedPayment.paymentDate,
            },
          },
          tx
        );

        const balance = calculateBalance(
          totalPurchases,
          newTotalPaid
        );

        return {
          payment: updatedPayment,
          totalPurchases,
          totalPaid: newTotalPaid,
          pendingBalance: balance.pendingBalance,
          customerCredit: balance.customerCredit,
          netBalance: balance.netBalance,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );

    return NextResponse.json({
      message: "Payment updated successfully.",
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PAYMENT_NOT_FOUND") {
        return NextResponse.json(
          { error: "Payment not found." },
          { status: 404 }
        );
      }

      if (error.message === "CUSTOMER_NOT_FOUND") {
        return NextResponse.json(
          { error: "Customer not found." },
          { status: 404 }
        );
      }
    }

    console.error(
      "Customer payment update failed:",
      error
    );

    return NextResponse.json(
      { error: "Failed to update payment." },
      { status: 500 }
    );
  }
}

/*
 * ============================================================
 * DELETE CUSTOMER PAYMENT
 * ============================================================
 */
export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const { id: customerId } = await params;
    const url = new URL(request.url);

    const paymentId = (
      url.searchParams.get("paymentId") ?? ""
    ).trim();

    if (!paymentId) {
      return NextResponse.json(
        { error: "Payment ID is required." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const payment =
          await tx.customerPayment.findFirst({
            where: {
              id: paymentId,
              customerId,
            },
            select: {
              id: true,
              customerId: true,
              amount: true,
              note: true,
              paymentDate: true,
            },
          });

        if (!payment) {
          throw new Error("PAYMENT_NOT_FOUND");
        }

        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: {
            id: true,
            name: true,
            sales: {
              where: { status: "ACTIVE" },
              select: { amount: true },
            },
            payments: {
              select: {
                id: true,
                amount: true,
              },
            },
          },
        });

        if (!customer) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }

        const totalPurchases = customer.sales.reduce(
          (total, sale) => total + Number(sale.amount),
          0
        );

        const totalPaidBefore = customer.payments.reduce(
          (total, currentPayment) =>
            total + Number(currentPayment.amount),
          0
        );

        await tx.customerPayment.delete({
          where: { id: payment.id },
        });

        const totalPaid =
          totalPaidBefore - Number(payment.amount);

        const balance = calculateBalance(
          totalPurchases,
          totalPaid
        );

        await createAuditLog(
          {
            userId: admin.id,
            action: "DELETE",
            entityType: "CUSTOMER_PAYMENT",
            entityId: payment.id,
            oldValue: {
              customerId,
              customerName: customer.name,
              amount: Number(payment.amount),
              note: payment.note,
              paymentDate: payment.paymentDate,
            },
            newValue: null,
          },
          tx
        );

        return {
          paymentId: payment.id,
          totalPurchases,
          totalPaid,
          pendingBalance: balance.pendingBalance,
          customerCredit: balance.customerCredit,
          netBalance: balance.netBalance,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );

    return NextResponse.json({
      message: "Payment deleted successfully.",
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PAYMENT_NOT_FOUND") {
        return NextResponse.json(
          { error: "Payment not found for this customer." },
          { status: 404 }
        );
      }

      if (error.message === "CUSTOMER_NOT_FOUND") {
        return NextResponse.json(
          { error: "Customer not found." },
          { status: 404 }
        );
      }
    }

    console.error(
      "Customer payment deletion failed:",
      error
    );

    return NextResponse.json(
      { error: "Failed to delete payment." },
      { status: 500 }
    );
  }
}