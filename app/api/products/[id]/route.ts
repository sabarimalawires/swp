import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

function parseKg(value: unknown): number | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const text = String(value).trim();

  if (!/^\d+(\.\d{1,3})?$/.test(text)) {
    return null;
  }

  const number = Number(text);

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return number;
}

const productSelect = {
  id: true,
  name: true,
  code: true,
  initialStockKg: true,
  lowStockThresholdKg: true,
  isActive: true,
} as const;

export async function PATCH(
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

    const action = String(body.action ?? "")
      .trim()
      .toUpperCase();

    const product = await prisma.product.findUnique({
      where: { id },
      select: productSelect,
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    // DEACTIVATE / REACTIVATE
    if (
      action === "DEACTIVATE" ||
      action === "REACTIVATE"
    ) {
      const nextActive = action === "REACTIVATE";

      if (product.isActive === nextActive) {
        return NextResponse.json({
          message: nextActive
            ? "Product is already active."
            : "Product is already deactivated.",
          product: {
            ...product,
            initialStockKg: Number(product.initialStockKg),
            lowStockThresholdKg: Number(
              product.lowStockThresholdKg
            ),
          },
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const updatedProduct = await tx.product.update({
          where: { id },
          data: { isActive: nextActive },
          select: productSelect,
        });

        await createAuditLog(
          {
            userId: admin.id,
            action: nextActive ? "REACTIVATE" : "DEACTIVATE",
            entityType: "PRODUCT",
            entityId: product.id,
            oldValue: {
              name: product.name,
              code: product.code,
              initialStockKg: Number(product.initialStockKg),
              lowStockThresholdKg: Number(
                product.lowStockThresholdKg
              ),
              isActive: product.isActive,
            },
            newValue: {
              name: updatedProduct.name,
              code: updatedProduct.code,
              initialStockKg: Number(
                updatedProduct.initialStockKg
              ),
              lowStockThresholdKg: Number(
                updatedProduct.lowStockThresholdKg
              ),
              isActive: updatedProduct.isActive,
            },
          },
          tx
        );

        return updatedProduct;
      });

      return NextResponse.json({
        message: nextActive
          ? "Product reactivated successfully."
          : "Product deactivated successfully.",
        product: {
          ...result,
          initialStockKg: Number(result.initialStockKg),
          lowStockThresholdKg: Number(
            result.lowStockThresholdKg
          ),
        },
      });
    }

    // UPDATE
    if (action !== "UPDATE") {
      return NextResponse.json(
        {
          error:
            "Action must be UPDATE, DEACTIVATE or REACTIVATE.",
        },
        { status: 400 }
      );
    }

    const name = String(body.name ?? "").trim();
    const code = String(body.code ?? "").trim();

    const lowStockThresholdKg = parseKg(
      body.lowStockThresholdKg
    );

    if (!name) {
      return NextResponse.json(
        { error: "Product name is required." },
        { status: 400 }
      );
    }

    if (name.length < 2) {
      return NextResponse.json(
        {
          error:
            "Product name must be at least 2 characters.",
        },
        { status: 400 }
      );
    }

    if (lowStockThresholdKg === null) {
      return NextResponse.json(
        {
          error:
            "Low-stock threshold must be a non-negative number with at most 3 decimal places, in kg.",
        },
        { status: 400 }
      );
    }

    const duplicateName = await prisma.product.findFirst({
      where: { name, NOT: { id } },
      select: { id: true },
    });

    if (duplicateName) {
      return NextResponse.json(
        {
          error:
            "A product with this name already exists.",
        },
        { status: 409 }
      );
    }

    if (code) {
      const duplicateCode = await prisma.product.findFirst({
        where: { code, NOT: { id } },
        select: { id: true },
      });

      if (duplicateCode) {
        return NextResponse.json(
          {
            error:
              "A product with this code already exists.",
          },
          { status: 409 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id },
        data: {
          name,
          code: code || null,
          lowStockThresholdKg,
        },
        select: productSelect,
      });

      await createAuditLog(
        {
          userId: admin.id,
          action: "UPDATE",
          entityType: "PRODUCT",
          entityId: product.id,
          oldValue: {
            name: product.name,
            code: product.code,
            initialStockKg: Number(product.initialStockKg),
            lowStockThresholdKg: Number(
              product.lowStockThresholdKg
            ),
            isActive: product.isActive,
          },
          newValue: {
            name: updatedProduct.name,
            code: updatedProduct.code,
            initialStockKg: Number(
              updatedProduct.initialStockKg
            ),
            lowStockThresholdKg: Number(
              updatedProduct.lowStockThresholdKg
            ),
            isActive: updatedProduct.isActive,
          },
        },
        tx
      );

      return updatedProduct;
    });

    return NextResponse.json({
      message: "Product updated successfully.",
      product: {
        ...result,
        initialStockKg: Number(result.initialStockKg),
        lowStockThresholdKg: Number(
          result.lowStockThresholdKg
        ),
      },
    });
  } catch (error) {
    console.error("Product update failed:", error);

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "A product with this name or code already exists.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update product." },
      { status: 500 }
    );
  }
}