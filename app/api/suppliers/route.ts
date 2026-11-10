
import { NextResponse } from "next/server";

import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

function getSupplierInput(body: Record<string, unknown>) {
  return {
    name: String(body.name ?? "").trim(),
    phone: String(body.phone ?? "").trim(),
    email: String(body.email ?? "").trim(),
    address: String(body.address ?? "").trim(),
    gstNumber: String(body.gstNumber ?? "").trim().toUpperCase(),
  };
}

function validateSupplier(input: ReturnType<typeof getSupplierInput>) {
  if (!input.name || input.name.length > 200) {
    return "Supplier name is required and must be 200 characters or less.";
  }

  if (
    input.phone &&
    !/^[0-9+\-\s()]{7,20}$/.test(input.phone)
  ) {
    return "Enter a valid supplier phone number.";
  }

  if (
    input.email &&
    (input.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
  ) {
    return "Enter a valid email address.";
  }

  if (input.address.length > 1000) {
    return "Address must be 1000 characters or less.";
  }

  if (input.gstNumber && !/^[0-9A-Z]{15}$/.test(input.gstNumber)) {
    return "Enter a valid 15-character GST number.";
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const employee = await requireAdmin(request);

    if (!employee) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.trim();

    const suppliers = await prisma.supplier.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
              { gstNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
      take: 100,
      include: {
        purchases: {
          where: { status: "ACTIVE" },
          select: {
            totalAmount: true,
          },
        },
        payments: {
          select: {
            amount: true,
          },
        },
      },
    });

    const result = suppliers.map((supplier) => {
      const totalPurchases = supplier.purchases.reduce(
        (sum, purchase) => sum + Number(purchase.totalAmount),
        0,
      );

      const totalPaid = supplier.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );

      const netBalance = totalPurchases - totalPaid;

      return {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        gstNumber: supplier.gstNumber,
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt,

        purchasesCount: supplier.purchases.length,
        paymentsCount: supplier.payments.length,

        totalPurchases,
        totalPaid,
        netBalance,

        pendingBalance: Math.max(netBalance, 0),
        supplierCredit: Math.max(-netBalance, 0),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Supplier lookup failed:", error);

    return NextResponse.json(
      { error: "Failed to load suppliers." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const employee = await requireAdmin(request);

    if (!employee) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const input = getSupplierInput(body);
    const validationError = validateSupplier(input);

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 },
      );
    }

    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: {
          name: input.name,
          phone: input.phone || null,
          email: input.email || null,
          address: input.address || null,
          gstNumber: input.gstNumber || null,
        },
      });

      await createAuditLog(
        {
          userId: employee.id,
          action: "CREATE",
          entityType: "SUPPLIER",
          entityId: created.id,
          oldValue: null,
          newValue: input,
        },
        tx,
      );

      return created;
    });

    return NextResponse.json(
      { message: "Supplier created successfully.", supplier },
      { status: 201 },
    );
  } catch (error) {
    console.error("Supplier creation failed:", error);

    return NextResponse.json(
      { error: "Failed to create supplier." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const employee = await requireAdmin(request);

    if (!employee) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const id = String(body.id ?? "").trim();

    if (!id) {
      return NextResponse.json(
        { error: "Supplier ID is required." },
        { status: 400 },
      );
    }

    const input = getSupplierInput(body);
    const validationError = validateSupplier(input);

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 },
      );
    }

    const supplier = await prisma.$transaction(async (tx) => {
      const existing = await tx.supplier.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error("SUPPLIER_NOT_FOUND");
      }

      const updated = await tx.supplier.update({
        where: { id },
        data: {
          name: input.name,
          phone: input.phone || null,
          email: input.email || null,
          address: input.address || null,
          gstNumber: input.gstNumber || null,
        },
      });

      await createAuditLog(
        {
          userId: employee.id,
          action: "UPDATE",
          entityType: "SUPPLIER",
          entityId: updated.id,
          oldValue: existing,
          newValue: input,
        },
        tx,
      );

      return updated;
    });

    return NextResponse.json({
      message: "Supplier updated successfully.",
      supplier,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SUPPLIER_NOT_FOUND") {
      return NextResponse.json(
        { error: "Supplier not found." },
        { status: 404 },
      );
    }

    console.error("Supplier update failed:", error);

    return NextResponse.json(
      { error: "Failed to update supplier." },
      { status: 500 },
    );
  }
}
