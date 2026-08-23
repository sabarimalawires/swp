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

    const body = await request.json();

    const rejectionReason = String(
      body.rejectionReason ?? ""
    ).trim();

    if (!rejectionReason) {
      return NextResponse.json(
        {
          error:
            "Rejection reason is required.",
        },
        { status: 400 }
      );
    }

    if (rejectionReason.length > 500) {
      return NextResponse.json(
        {
          error:
            "Rejection reason must be 500 characters or less.",
        },
        { status: 400 }
      );
    }

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
          },
        });

        if (!entry) {
          throw new Error("WORK_ENTRY_NOT_FOUND");
        }

        if (entry.status !== "PENDING") {
          throw new Error("WORK_ENTRY_ALREADY_PROCESSED");
        }

        const updatedEntry =
          await tx.workEntry.update({
            where: { id },
            data: {
              status: "REJECTED",
              rejectionReason,
              approvedAt: null,
              approvedById: null,
            },
            select: {
              id: true,
              status: true,
              rejectionReason: true,
            },
          });

        await createAuditLog(
          {
            userId: admin.id,
            action: "REJECT",
            entityType: "WORK_ENTRY",
            entityId: entry.id,
            oldValue: {
              status: "PENDING",
            },
            newValue: {
              status: "REJECTED",
              rejectionReason,
            },
          },
          tx
        );

        return updatedEntry;
      }
    );

    return NextResponse.json({
      message: "Work entry rejected successfully.",
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
    }

    console.error(
      "Work rejection failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to reject work entry.",
      },
      { status: 500 }
    );
  }
}