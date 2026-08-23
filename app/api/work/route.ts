import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: {
        authUserId: session.user.id,
      },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    if (!employee || employee.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Active employee access required." },
        { status: 403 }
      );
    }

    const where =
      employee.role === "WORKER"
        ? { workerId: employee.id }
        : {};

    const entries = await prisma.workEntry.findMany({
      where,
      select: {
        id: true,
        quantity: true,
        status: true,
        submittedAt: true,
        rejectionReason: true,
        worker: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
      orderBy: {
        submittedAt: "desc",
      },
      take: 100,
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Work lookup failed:", error);

    return NextResponse.json(
      { error: "Failed to load work entries." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: {
        authUserId: session.user.id,
      },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    if (!employee || employee.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Active employee access required." },
        { status: 403 }
      );
    }

    if (employee.role !== "WORKER") {
      return NextResponse.json(
        { error: "Only workers can submit work." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const productId = String(
      body.productId ?? ""
    ).trim();

    const quantity = Number(body.quantity);

    if (!productId) {
      return NextResponse.json(
        { error: "Product is required." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Quantity must be a whole number greater than 0.",
        },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    if (!product.isActive) {
      return NextResponse.json(
        {
          error:
            "This product is inactive and cannot be used for new work.",
        },
        { status: 409 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const entry = await tx.workEntry.create({
          data: {
            workerId: employee.id,
            productId,
            quantity,
            status: "PENDING",
          },
          select: {
            id: true,
            quantity: true,
            status: true,
            submittedAt: true,
            product: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        });

        await createAuditLog(
          {
            userId: employee.id,
            action: "CREATE",
            entityType: "WORK_ENTRY",
            entityId: entry.id,
            oldValue: null,
            newValue: {
              workerId: employee.id,
              productId: product.id,
              quantity,
              status: "PENDING",
            },
          },
          tx
        );

        return entry;
      }
    );

    return NextResponse.json(
      {
        message: "Work entry submitted successfully.",
        entry: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Work submission failed:", error);

    return NextResponse.json(
      { error: "Failed to submit work entry." },
      { status: 500 }
    );
  }
}