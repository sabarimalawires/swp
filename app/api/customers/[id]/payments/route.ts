import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

    const note =
      body.note === undefined ||
      body.note === null
        ? null
        : String(body.note).trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          error:
            "Payment amount must be greater than ₹0.",
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
        const customer =
          await tx.customer.findUnique({
            where: {
              id: customerId,
            },
            select: {
              id: true,
              name: true,

              sales: {
                where: {
                  status: "ACTIVE",
                },
                select: {
                  amount: true,
                },
              },

              payments: {
                select: {
                  amount: true,
                },
              },
            },
          });

        if (!customer) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }

        const totalPurchases =
          customer.sales.reduce(
            (total, sale) =>
              total + Number(sale.amount),
            0
          );

        const totalPaid =
          customer.payments.reduce(
            (total, payment) =>
              total + Number(payment.amount),
            0
          );

        const pendingBalance = Math.max(
          0,
          totalPurchases - totalPaid
        );

        if (amount > pendingBalance) {
          throw new Error(
            "PAYMENT_EXCEEDS_BALANCE"
          );
        }

        const payment =
          await tx.customerPayment.create({
            data: {
              customerId,
              amount,
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

        const newTotalPaid =
          totalPaid + amount;

        const remainingBalance =
          Math.max(
            0,
            totalPurchases - newTotalPaid
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
              paymentDate:
                payment.paymentDate,
            },
          },
          tx
        );

        return {
          payment,
          totalPurchases,
          totalPaid: newTotalPaid,
          remainingBalance,
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
    if (error instanceof Error) {
      if (
        error.message ===
        "CUSTOMER_NOT_FOUND"
      ) {
        return NextResponse.json(
          {
            error: "Customer not found.",
          },
          { status: 404 }
        );
      }

      if (
        error.message ===
        "PAYMENT_EXCEEDS_BALANCE"
      ) {
        return NextResponse.json(
          {
            error:
              "Payment cannot be greater than the customer's pending balance.",
          },
          { status: 409 }
        );
      }
    }

    console.error(
      "Customer payment creation failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to record payment.",
      },
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

    const note =
      body.note === undefined ||
      body.note === null
        ? null
        : String(body.note).trim();

    if (!paymentId) {
      return NextResponse.json(
        {
          error: "Payment ID is required.",
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          error:
            "Payment amount must be greater than ₹0.",
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
        /*
         * Find the payment and make sure it
         * belongs to this customer.
         */
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
          throw new Error(
            "PAYMENT_NOT_FOUND"
          );
        }

        /*
         * Load the customer's current financial
         * information.
         */
        const customer =
          await tx.customer.findUnique({
            where: {
              id: customerId,
            },
            select: {
              id: true,
              name: true,

              sales: {
                where: {
                  status: "ACTIVE",
                },
                select: {
                  amount: true,
                },
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
          throw new Error(
            "CUSTOMER_NOT_FOUND"
          );
        }

        /*
         * Calculate total purchases.
         */
        const totalPurchases =
          customer.sales.reduce(
            (total, sale) =>
              total + Number(sale.amount),
            0
          );

        /*
         * Calculate payments EXCLUDING the
         * payment currently being edited.
         */
        const totalPaidWithoutCurrent =
          customer.payments.reduce(
            (total, currentPayment) => {
              if (
                currentPayment.id ===
                payment.id
              ) {
                return total;
              }

              return (
                total +
                Number(currentPayment.amount)
              );
            },
            0
          );

        /*
         * The edited payment cannot make the
         * customer's total paid amount greater
         * than their total purchases.
         */
        const maximumAllowed = Math.max(
          0,
          totalPurchases -
            totalPaidWithoutCurrent
        );

        if (amount > maximumAllowed) {
          throw new Error(
            "PAYMENT_EXCEEDS_BALANCE"
          );
        }

        /*
         * Update the payment.
         */
        const updatedPayment =
          await tx.customerPayment.update({
            where: {
              id: payment.id,
            },

            data: {
              amount,
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

        /*
         * Record the change in the audit log.
         */
        await createAuditLog(
          {
            userId: admin.id,
            action: "UPDATE",
            entityType: "CUSTOMER_PAYMENT",
            entityId: payment.id,

            oldValue: {
              customerId,
              customerName: customer.name,
              amount:
                Number(payment.amount),
              note: payment.note,
              paymentDate:
                payment.paymentDate,
            },

            newValue: {
              customerId,
              customerName: customer.name,
              amount,
              note,
              paymentDate:
                updatedPayment.paymentDate,
            },
          },
          tx
        );

        /*
         * Calculate the new customer balance.
         */
        const newTotalPaid =
          totalPaidWithoutCurrent +
          amount;

        const pendingBalance =
          Math.max(
            0,
            totalPurchases -
              newTotalPaid
          );

        return {
          payment: updatedPayment,
          totalPurchases,
          totalPaid: newTotalPaid,
          pendingBalance,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );

    return NextResponse.json({
      message:
        "Payment updated successfully.",
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message ===
        "PAYMENT_NOT_FOUND"
      ) {
        return NextResponse.json(
          {
            error: "Payment not found.",
          },
          { status: 404 }
        );
      }

      if (
        error.message ===
        "CUSTOMER_NOT_FOUND"
      ) {
        return NextResponse.json(
          {
            error: "Customer not found.",
          },
          { status: 404 }
        );
      }

      if (
        error.message ===
        "PAYMENT_EXCEEDS_BALANCE"
      ) {
        return NextResponse.json(
          {
            error:
              "The updated payment would make the customer's total paid amount greater than their purchases.",
          },
          { status: 409 }
        );
      }
    }

    console.error(
      "Customer payment update failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update payment.",
      },
      { status: 500 }
    );
  }
}