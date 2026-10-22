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
        weight: true,
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

    const weight = Number(body.weight);

    if (!productId) {
      return NextResponse.json(
        { error: "Product is required." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(weight) ||
      weight <= 0 ||
      Math.abs(
        weight * 1000 - Math.round(weight * 1000)
      ) > 1e-8
    ) {
      return NextResponse.json(
        {
          error:
            "Weight must be greater than 0 kg and have no more than 3 decimal places.",
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
            quantity: 0,
            weight,
            status: "PENDING",
          },
          select: {
            id: true,
            quantity: true,
            weight: true,
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
              weight,
              unit: "kg",
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