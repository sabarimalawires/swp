import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const customers = await prisma.customer.findMany({
      orderBy: {
        name: "asc",
      },

      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,

        sales: {
          where: {
            status: "ACTIVE",
          },

          select: {
            id: true,
            amount: true,
            weight: true,
            quantity: true,
            saleDate: true,
          },

          orderBy: {
            saleDate: "desc",
          },
        },

        payments: {
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

          orderBy: {
            paymentDate: "desc",
          },
        },
      },
    });

    const formattedCustomers = customers.map(
      (customer) => {
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

        return {
          id: customer.id,
          name: customer.name,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,

          totalPurchases,
          totalPaid,
          pendingBalance,

          salesCount:
            customer.sales.length,

          sales: customer.sales.map(
            (sale) => ({
              id: sale.id,
              amount: Number(sale.amount),
              weight: Number(sale.weight),
              quantity: sale.quantity,
              saleDate: sale.saleDate,
            })
          ),

          payments:
            customer.payments.map(
              (payment) => ({
                id: payment.id,
                amount: Number(
                  payment.amount
                ),
                paymentDate:
                  payment.paymentDate,
                note: payment.note,
                createdBy:
                  payment.createdBy,
              })
            ),
        };
      }
    );

    return NextResponse.json(
      formattedCustomers
    );
  } catch (error) {
    console.error(
      "Customer lookup failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load customers.",
      },
      { status: 500 }
    );
  }
}