
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

export async function POST(
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

    const sale = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.sale.findUnique({
          where: { id },
          include: {
            customer: { select: { id: true, name: true } },
            items: true,
          },
        });

        if (!existing) throw new Error("SALE_NOT_FOUND");
        if (existing.status === "VOIDED") {
          throw new Error("SALE_ALREADY_VOIDED");
        }
        if (existing.items.length === 0) {
          throw new Error("SALE_ITEMS_MISSING");
        }

        const voided = await tx.sale.update({
          where: { id },
          data: {
            status: "VOIDED",
            voidedById: admin.id,
            voidedAt: new Date(),
          },
        });

        for (const item of existing.items) {
          if (item.deductedQuantity <= 0) continue;

          await tx.inventoryTransaction.create({
            data: {
              productId: item.productId,
              type: "SALE_VOID",
              quantity: item.deductedQuantity,
              referenceType: "SALE_VOID",
              referenceId: existing.id,
              createdById: admin.id,
              saleId: existing.id,
            },
          });
        }

        await createAuditLog(
          {
            userId: admin.id,
            action: "VOID",
            entityType: "SALE",
            entityId: existing.id,
            oldValue: {
              customerId: existing.customerId,
              customerName: existing.customer.name,
              amount: Number(existing.amount),
              status: existing.status,
              items: existing.items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                deductedQuantity: item.deductedQuantity,
              })),
            },
            newValue: {
              status: "VOIDED",
              voidedById: admin.id,
              voidedAt: voided.voidedAt,
            },
          },
          tx,
        );

        return voided;
      },
      { isolationLevel: "Serializable" },
    );

    return NextResponse.json({
      message: "Sale voided successfully.",
      sale,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SALE_NOT_FOUND") {
        return NextResponse.json({ error: "Sale not found." }, { status: 404 });
      }

      if (error.message === "SALE_ALREADY_VOIDED") {
        return NextResponse.json(
          { error: "Sale is already voided." },
          { status: 409 },
        );
      }

      if (error.message === "SALE_ITEMS_MISSING") {
        return NextResponse.json(
          { error: "Sale items are missing; the sale was not changed." },
          { status: 409 },
        );
      }
    }

    console.error("Sale void failed:", error);
    return NextResponse.json(
      { error: "Failed to void sale." },
      { status: 500 },
    );
  }
}
