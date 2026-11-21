
import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";

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

    const productId = (searchParams.get("productId") ?? "").trim();
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (
      !productId ||
      !datePattern.test(from) ||
      !datePattern.test(to)
    ) {
      return NextResponse.json(
        { error: "Select a product and provide a valid date range." },
        { status: 400 },
      );
    }

    if (from > to) {
      return NextResponse.json(
        { error: "From date cannot be later than To date." },
        { status: 400 },
      );
    }

    const startDate = new Date(`${from}T00:00:00.000Z`);
    const endDate = new Date(`${to}T23:59:59.999Z`);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 },
      );
    }

    const result = await prisma.saleItem.aggregate({
      where: {
        productId,
        sale: {
          status: "ACTIVE",
          saleDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      _sum: {
        weight: true,
      },
      _count: {
        _all: true,
      },
    });

    return NextResponse.json({
      productName: product.name,
      totalWeight: Number(result._sum.weight ?? 0),
      saleCount: result._count._all,
      from,
      to,
    });
  } catch (error) {
    console.error("Sales weight report failed:", error);

    return NextResponse.json(
      { error: "Failed to generate sales weight report." },
      { status: 500 },
    );
  }
}
