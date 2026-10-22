
import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

function parseKg(value: unknown, fieldName: string): number | null {
  if (value === undefined || value === null || value === "") {
    return fieldName === "Initial stock" ? 0 : null;
  }

  const valueNumber = Number(value);

  if (
    !Number.isFinite(valueNumber) ||
    valueNumber < 0 ||
    !/^\d+(\.\d{1,3})?$/.test(String(value).trim())
  ) {
    return null;
  }

  return valueNumber;
}

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { authUserId: session.user.id },
      select: { status: true },
    });

    if (!employee || employee.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Employee access required." },
        { status: 403 },
      );
    }

    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        initialStockKg: true,
        lowStockThresholdKg: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      products.map((product) => ({
        ...product,
        initialStockKg: Number(product.initialStockKg),
        lowStockThresholdKg: Number(product.lowStockThresholdKg),
      })),
    );
  } catch (error) {
    console.error("Products lookup failed:", error);

    return NextResponse.json(
      { error: "Failed to load products." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const code = String(body.code ?? "").trim();

    const initialStockKg = parseKg(
      body.initialStockKg,
      "Initial stock",
    );

    const lowStockThresholdKg = parseKg(
      body.lowStockThresholdKg ?? 0,
      "Low stock threshold",
    );

    if (name.length < 2) {
      return NextResponse.json(
        { error: "Product name must be at least 2 characters." },
        { status: 400 },
      );
    }

    if (initialStockKg === null) {
      return NextResponse.json(
        {
          error:
            "Initial stock must be a non-negative number in kg with up to 3 decimal places.",
        },
        { status: 400 },
      );
    }

    if (lowStockThresholdKg === null) {
      return NextResponse.json(
        {
          error:
            "Low stock threshold must be a non-negative number in kg with up to 3 decimal places.",
        },
        { status: 400 },
      );
    }

    const existingName = await prisma.product.findUnique({
      where: { name },
      select: { id: true, isActive: true },
    });

    if (existingName) {
      return NextResponse.json(
        {
          error: existingName.isActive
            ? "A product with this name already exists."
            : "A deactivated product with this name already exists. Reactivate it instead of creating a duplicate.",
        },
        { status: 409 },
      );
    }

    if (code) {
      const existingCode = await prisma.product.findUnique({
        where: { code },
        select: { id: true },
      });

      if (existingCode) {
        return NextResponse.json(
          { error: "A product with this code already exists." },
          { status: 409 },
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name,
          code: code || null,
          initialStockKg,
          lowStockThresholdKg,
          isActive: true,
        },
      });

      await createAuditLog(
        {
          userId: admin.id,
          action: "CREATE",
          entityType: "PRODUCT",
          entityId: product.id,
          oldValue: null,
          newValue: {
            name: product.name,
            code: product.code,
            initialStockKg: Number(product.initialStockKg),
            lowStockThresholdKg: Number(
              product.lowStockThresholdKg,
            ),
            isActive: product.isActive,
          },
        },
        tx,
      );

      return product;
    });

    return NextResponse.json(
      {
        message: "Product created successfully.",
        product: {
          ...result,
          initialStockKg: Number(result.initialStockKg),
          lowStockThresholdKg: Number(result.lowStockThresholdKg),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Product creation failed:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A product with this name or code already exists." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create product." },
      { status: 500 },
    );
  }
}
