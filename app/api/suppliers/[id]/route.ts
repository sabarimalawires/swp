
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
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

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: {
          where: { status: "ACTIVE" },
          orderBy: [
            { purchaseDate: "desc" },
            { createdAt: "desc" },
          ],
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
            createdBy: {
              select: {
                name: true,
                username: true,
              },
            },
          },
        },
        payments: {
          orderBy: [
            { paymentDate: "desc" },
            { createdAt: "desc" },
          ],
          include: {
            createdBy: {
              select: {
                name: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found." },
        { status: 404 },
      );
    }

    const totalPurchases = supplier.purchases.reduce(
      (total, purchase) =>
        total + Number(purchase.totalAmount),
      0,
    );

    const totalPaid = supplier.payments.reduce(
      (total, payment) =>
        total + Number(payment.amount),
      0,
    );

    const netBalance = totalPurchases - totalPaid;

    const ledger = [
      ...supplier.purchases.map((purchase) => ({
        id: purchase.id,
        type: "PURCHASE" as const,
        date: purchase.purchaseDate,
        description: purchase.invoiceNumber
          ? `Purchase Invoice ${purchase.invoiceNumber}`
          : "Purchase",
        debit: 0,
        credit: Number(purchase.totalAmount),
        referenceId: purchase.id,
        createdAt: purchase.createdAt,
      })),
      ...supplier.payments.map((payment) => ({
        id: payment.id,
        type: "PAYMENT" as const,
        date: payment.paymentDate,
        description: payment.note || "Supplier Payment",
        debit: Number(payment.amount),
        credit: 0,
        referenceId: payment.id,
        createdAt: payment.createdAt,
      })),
    ].sort((a, b) => {
      const dateDifference =
        new Date(a.date).getTime() -
        new Date(b.date).getTime();

      if (dateDifference !== 0) return dateDifference;

      return (
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
      );
    });

    let runningBalance = 0;

    const ledgerWithBalance = ledger.map((entry) => {
      runningBalance += entry.credit - entry.debit;

      return {
        ...entry,
        balance: runningBalance,
      };
    });

    return NextResponse.json({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        gstNumber: supplier.gstNumber,
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt,
      },

      purchases: supplier.purchases,
      payments: supplier.payments,

      totalPurchases,
      totalPaid,
      netBalance,
      pendingBalance: Math.max(netBalance, 0),
      supplierCredit: Math.max(-netBalance, 0),

      purchasesCount: supplier.purchases.length,
      paymentsCount: supplier.payments.length,

      ledger: ledgerWithBalance,
    });
  } catch (error) {
    console.error("Supplier details lookup failed:", error);

    return NextResponse.json(
      { error: "Failed to load supplier details." },
      { status: 500 },
    );
  }
}
