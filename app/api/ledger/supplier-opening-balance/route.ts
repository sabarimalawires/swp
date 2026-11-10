import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";

export async function PUT(request: Request) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const supplierId =
      typeof body.supplierId === "string"
        ? body.supplierId.trim()
        : "";

    const financialYearStartValue = body.financialYearStart;

    const openingBalanceValue = body.openingBalance;

    const overrideReason =
      typeof body.overrideReason === "string"
        ? body.overrideReason.trim()
        : "";

    if (!supplierId) {
      return NextResponse.json(
        { error: "Supplier is required." },
        { status: 400 }
      );
    }

    if (
      typeof financialYearStartValue !== "string" ||
      !/^\d{4}-04-01(?:T.*)?$/.test(financialYearStartValue)
    ) {
      return NextResponse.json(
        { error: "Financial year must start on April 1." },
        { status: 400 }
      );
    }

    const year = Number(financialYearStartValue.slice(0, 4));

    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      return NextResponse.json(
        { error: "Invalid financial year." },
        { status: 400 }
      );
    }

    const financialYearStart = new Date(Date.UTC(year, 3, 1));

    const openingBalance = Number(openingBalanceValue);

    if (
      openingBalanceValue === "" ||
      openingBalanceValue === null ||
      openingBalanceValue === undefined ||
      !Number.isFinite(openingBalance)
    ) {
      return NextResponse.json(
        { error: "Enter a valid opening balance." },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found." },
        { status: 404 }
      );
    }

    const saved =
      await prisma.supplierLedgerOpeningBalance.upsert({
        where: {
          supplierId_financialYearStart: {
            supplierId,
            financialYearStart,
          },
        },
        create: {
          supplierId,
          financialYearStart,
          openingBalance,
          isManualOverride: true,
          overrideReason: overrideReason || null,
        },
        update: {
          openingBalance,
          isManualOverride: true,
          overrideReason: overrideReason || null,
        },
      });

    return NextResponse.json({
      success: true,
      openingBalance: Number(saved.openingBalance),
    });
  } catch (error) {
    console.error("Supplier opening balance update failed:", error);

    return NextResponse.json(
      { error: "Failed to save supplier opening balance." },
      { status: 500 }
    );
  }
}