
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

export async function PUT(request: Request) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const body: unknown = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const input = body as {
      customerId?: unknown;
      financialYearStart?: unknown;
      openingBalance?: unknown;
      overrideReason?: unknown;
    };

    const { customerId, financialYearStart, openingBalance, overrideReason } =
      input;

    if (
      typeof customerId !== "string" ||
      !customerId.trim() ||
      typeof financialYearStart !== "string" ||
      !/^\d{4}-04-01$/.test(financialYearStart) ||
      typeof openingBalance !== "number" ||
      !Number.isFinite(openingBalance) ||
      Math.abs(openingBalance) > 999999999999.99
    ) {
      return NextResponse.json(
        {
          error:
            "Provide a customer, a financial year start in YYYY-04-01 format, and a valid numeric opening balance.",
        },
        { status: 400 }
      );
    }

    if (
      overrideReason !== undefined &&
      overrideReason !== null &&
      (typeof overrideReason !== "string" ||
        overrideReason.length > 500)
    ) {
      return NextResponse.json(
        { error: "The override reason must be 500 characters or fewer." },
        { status: 400 }
      );
    }

    const start = new Date(`${financialYearStart}T00:00:00.000Z`);
    const roundedBalance = Math.round(openingBalance * 100) / 100;
    const reason =
      typeof overrideReason === "string"
        ? overrideReason.trim() || null
        : null;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const previous =
        await tx.customerLedgerOpeningBalance.findUnique({
          where: {
            customerId_financialYearStart: {
              customerId,
              financialYearStart: start,
            },
          },
        });

      const saved = await tx.customerLedgerOpeningBalance.upsert({
        where: {
          customerId_financialYearStart: {
            customerId,
            financialYearStart: start,
          },
        },
        create: {
          customerId,
          financialYearStart: start,
          openingBalance: roundedBalance,
          isManualOverride: true,
          overrideReason: reason,
          updatedById: admin.id,
        },
        update: {
          openingBalance: roundedBalance,
          isManualOverride: true,
          overrideReason: reason,
          updatedById: admin.id,
        },
      });

      await createAuditLog(
        {
          userId: admin.id,
          action: "UPDATE",
          entityType: "CUSTOMER",
          entityId: customerId,
          oldValue: {
            event: "LEDGER_OPENING_BALANCE_UPDATED",
            financialYearStart,
            openingBalance: previous
              ? Number(previous.openingBalance)
              : null,
            isManualOverride: previous?.isManualOverride ?? false,
          },
          newValue: {
            event: "LEDGER_OPENING_BALANCE_UPDATED",
            financialYearStart,
            openingBalance: roundedBalance,
            isManualOverride: true,
            overrideReason: reason,
          },
        },
        tx
      );

      return saved;
    });

    return NextResponse.json({
      message: "Opening balance saved successfully.",
      openingBalance: {
        customerId: result.customerId,
        financialYearStart: result.financialYearStart,
        openingBalance: Number(result.openingBalance),
        isManualOverride: result.isManualOverride,
        overrideReason: result.overrideReason,
        updatedAt: result.updatedAt,
      },
    });
  } catch (error) {
    console.error("Opening balance update failed:", error);

    return NextResponse.json(
      { error: "Failed to save opening balance." },
      { status: 500 }
    );
  }
}
