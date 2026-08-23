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
        const entry = await tx.workEntry.findUnique({
          where: { id },
          select: {
            id: true,
            workerId: true,
            productId: true,
            quantity: true,
            status: true,
            product: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
        });

        if (!entry) {
          throw new Error("WORK_ENTRY_NOT_FOUND");
        }

        if (entry.status !== "PENDING") {
          throw new Error("WORK_ENTRY_ALREADY_PROCESSED");
        }

        if (!entry.product.isActive) {
          throw new Error("PRODUCT_INACTIVE");
        }

        const worker = await tx.employee.findUnique({
          where: {
            id: entry.workerId,
          },
          select: {
            status: true,
          },
        });

        if (!worker || worker.status !== "ACTIVE") {
          throw new Error("WORKER_INACTIVE");
        }

        const updatedEntry =
          await tx.workEntry.update({
            where: { id },
            data: {
              status: "APPROVED",
              approvedAt: new Date(),
              approvedById: admin.id,
              rejectionReason: null,
            },
            select: {
              id: true,
              status: true,
              approvedAt: true,
            },
          });

        await tx.inventoryTransaction.create({
          data: {
            productId: entry.productId,
            type: "PRODUCTION",
            quantity: entry.quantity,
            referenceType: "WORK_ENTRY",
            referenceId: entry.id,
            createdById: admin.id,
            workEntryId: entry.id,
          },
        });

        await createAuditLog(
          {
            userId: admin.id,
            action: "APPROVE",
            entityType: "WORK_ENTRY",
            entityId: entry.id,
            oldValue: {
              status: "PENDING",
            },
            newValue: {
              status: "APPROVED",
              quantity: entry.quantity,
              productId: entry.productId,
              approvedById: admin.id,
            },
          },
          tx
        );

        return updatedEntry;
      }
    );

    return NextResponse.json({
      message: "Work entry approved successfully.",
      entry: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "WORK_ENTRY_NOT_FOUND") {
        return NextResponse.json(
          { error: "Work entry not found." },
          { status: 404 }
        );
      }

      if (
        error.message ===
        "WORK_ENTRY_ALREADY_PROCESSED"
      ) {
        return NextResponse.json(
          {
            error:
              "This work entry has already been processed.",
          },
          { status: 409 }
        );
      }

      if (error.message === "PRODUCT_INACTIVE") {
        return NextResponse.json(
          {
            error:
              "This product is inactive and cannot receive production.",
          },
          { status: 409 }
        );
      }

      if (error.message === "WORKER_INACTIVE") {
        return NextResponse.json(
          {
            error:
              "The worker account is inactive.",
          },
          { status: 409 }
        );
      }
    }

    console.error(
      "Work approval failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to approve work entry.",
      },
      { status: 500 }
    );
  }
}