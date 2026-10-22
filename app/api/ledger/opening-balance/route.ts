
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

    const customerId =
      typeof body.customerId === "string" ? body.customerId.trim() : "";

    const financialYearStartValue = body.financialYearStart;
    const openingBalanceValue = body.openingBalance;
    const overrideReason =
      typeof body.overrideReason === "string"
        ? body.overrideReason.trim()
        : "";

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer is required." },
        { status: 400 }
      );
    }

    const year = Number(financialYearStartValue.slice(0, 4));
    const financialYearStart = new Date(Date.UTC(year, 3, 1));

    if (
      typeof financialYearStartValue !== "string" ||
      !/^\d{4}-04-01(?:T.*)?$/.test(financialYearStartValue) ||
      Number.isNaN(financialYearStart.getTime())
    ) {
      return NextResponse.json(
        { error: "Financial year must start on April 1." },
        { status: 400 }
      );
    }

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

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found." },
        { status: 404 }
      );
    }

    const saved = await prisma.customerLedgerOpeningBalance.upsert({
      where: {
        customerId_financialYearStart: {
          customerId,
          financialYearStart,
        },
      },
      create: {
        customerId,
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
    console.error("Opening balance update failed:", error);

    return NextResponse.json(
      { error: "Failed to save opening balance." },
      { status: 500 }
    );
  }
}
