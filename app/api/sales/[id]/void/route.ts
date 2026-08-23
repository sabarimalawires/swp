import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const result = await prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.findUnique({
          where: {
            id,
          },
          select: {
            id: true,
            customerName: true,
            productId: true,
            quantity: true,
            saleDate: true,
            status: true,
          },
        });

        if (!sale) {
          throw new Error("SALE_NOT_FOUND");
        }

        if (sale.status === "VOIDED") {
          throw new Error("SALE_ALREADY_VOIDED");
        }

        /*
         * Update the sale and create the reversal
         * in the SAME transaction.
         */
        const updatedSale =
          await tx.sale.update({
            where: {
              id: sale.id,
            },
            data: {
              status: "VOIDED",
              voidedById: admin.id,
              voidedAt: new Date(),
            },
            select: {
              id: true,
              status: true,
              voidedAt: true,
            },
          });

        await tx.inventoryTransaction.create({
          data: {
            productId: sale.productId,
            type: "SALE_VOID",
            quantity: sale.quantity,
            referenceType: "SALE_VOID",
            referenceId: sale.id,
            createdById: admin.id,
            saleId: sale.id,
          },
        });

        await createAuditLog(
          {
            userId: admin.id,
            action: "VOID",
            entityType: "SALE",
            entityId: sale.id,
            oldValue: {
              customerName:
                sale.customerName,
              productId:
                sale.productId,
              quantity:
                sale.quantity,
              saleDate:
                sale.saleDate,
              status:
                sale.status,
            },
            newValue: {
              customerName:
                sale.customerName,
              productId:
                sale.productId,
              quantity:
                sale.quantity,
              saleDate:
                sale.saleDate,
              status: "VOIDED",
              voidedById:
                admin.id,
            },
          },
          tx
        );

        return updatedSale;
      },
      {
        isolationLevel: "Serializable",
      }
    );

    return NextResponse.json({
      message:
        "Sale voided successfully.",
      sale: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message ===
        "SALE_NOT_FOUND"
      ) {
        return NextResponse.json(
          {
            error:
              "Sale not found.",
          },
          { status: 404 }
        );
      }

      if (
        error.message ===
        "SALE_ALREADY_VOIDED"
      ) {
        return NextResponse.json(
          {
            error:
              "This sale has already been voided.",
          },
          { status: 409 }
        );
      }
    }

    console.error(
      "Sale void failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to void sale.",
      },
      { status: 500 }
    );
  }
}