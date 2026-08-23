import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

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
      select: {
        id: true,
        name: true,
        code: true,
        initialStock: true,
        lowStockThreshold: true,
        isActive: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // DEACTIVATE / REACTIVATE
    // --------------------------------------------------

    if (
      action === "DEACTIVATE" ||
      action === "REACTIVATE"
    ) {
      const nextActive =
        action === "REACTIVATE";

      if (product.isActive === nextActive) {
        return NextResponse.json({
          message: nextActive
            ? "Product is already active."
            : "Product is already deactivated.",
          product,
        });
      }

      const result = await prisma.$transaction(
        async (tx) => {
          const updatedProduct =
            await tx.product.update({
              where: { id },
              data: {
                isActive: nextActive,
              },
              select: {
                id: true,
                name: true,
                code: true,
                initialStock: true,
                lowStockThreshold: true,
                isActive: true,
              },
            });

          await createAuditLog(
            {
              userId: admin.id,
              action: nextActive
                ? "REACTIVATE"
                : "DEACTIVATE",
              entityType: "PRODUCT",
              entityId: product.id,
              oldValue: {
                name: product.name,
                code: product.code,
                initialStock:
                  product.initialStock,
                lowStockThreshold:
                  product.lowStockThreshold,
                isActive: product.isActive,
              },
              newValue: {
                name:
                  updatedProduct.name,
                code:
                  updatedProduct.code,
                initialStock:
                  updatedProduct.initialStock,
                lowStockThreshold:
                  updatedProduct.lowStockThreshold,
                isActive:
                  updatedProduct.isActive,
              },
            },
            tx
          );

          return updatedProduct;
        }
      );

      return NextResponse.json({
        message: nextActive
          ? "Product reactivated successfully."
          : "Product deactivated successfully.",
        product: result,
      });
    }

    // --------------------------------------------------
    // UPDATE
    // --------------------------------------------------

    if (action !== "UPDATE") {
      return NextResponse.json(
        {
          error:
            "Action must be UPDATE, DEACTIVATE or REACTIVATE.",
        },
        { status: 400 }
      );
    }

    const name = String(
      body.name ?? ""
    ).trim();

    const code = String(
      body.code ?? ""
    ).trim();

    const lowStockThreshold = Number(
      body.lowStockThreshold
    );

    if (!name) {
      return NextResponse.json(
        {
          error:
            "Product name is required.",
        },
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

    if (
      !Number.isInteger(
        lowStockThreshold
      ) ||
      lowStockThreshold < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Low stock threshold must be a whole number of 0 or greater.",
        },
        { status: 400 }
      );
    }

    if (
      lowStockThreshold >
      product.initialStock
    ) {
      return NextResponse.json(
        {
          error:
            "Low stock threshold cannot be greater than initial stock.",
        },
        { status: 400 }
      );
    }

    const duplicateName =
      await prisma.product.findFirst({
        where: {
          name,
          NOT: {
            id,
          },
        },
        select: {
          id: true,
        },
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
      const duplicateCode =
        await prisma.product.findFirst({
          where: {
            code,
            NOT: {
              id,
            },
          },
          select: {
            id: true,
          },
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

    const result = await prisma.$transaction(
      async (tx) => {
        const updatedProduct =
          await tx.product.update({
            where: { id },
            data: {
              name,
              code: code || null,
              lowStockThreshold,
            },
            select: {
              id: true,
              name: true,
              code: true,
              initialStock: true,
              lowStockThreshold: true,
              isActive: true,
            },
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
              initialStock:
                product.initialStock,
              lowStockThreshold:
                product.lowStockThreshold,
              isActive: product.isActive,
            },
            newValue: {
              name:
                updatedProduct.name,
              code:
                updatedProduct.code,
              initialStock:
                updatedProduct.initialStock,
              lowStockThreshold:
                updatedProduct.lowStockThreshold,
              isActive:
                updatedProduct.isActive,
            },
          },
          tx
        );

        return updatedProduct;
      }
    );

    return NextResponse.json({
      message:
        "Product updated successfully.",
      product: result,
    });
  } catch (error) {
    console.error(
      "Product update failed:",
      error
    );

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
      {
        error:
          "Failed to update product.",
      },
      { status: 500 }
    );
  }
}