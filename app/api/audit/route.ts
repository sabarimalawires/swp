import { NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";

const PAGE_SIZE = 50;

const validActions = [
  "CREATE",
  "UPDATE",
  "DEACTIVATE",
  "REACTIVATE",
  "APPROVE",
  "REJECT",
  "VOID",
  "LOGIN",
  "LOGOUT",
  "PASSWORD_CHANGE",
  "PASSWORD_RESET",
] as const;

const validEntityTypes = [
  "USER",
  "PRODUCT",
  "WORK_ENTRY",
  "SALE",
  "INVENTORY",
] as const;

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    const requestedPage = Number(
      searchParams.get("page") ?? "1"
    );

    const page =
      Number.isInteger(requestedPage) &&
      requestedPage > 0
        ? requestedPage
        : 1;

    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");
    const userId = searchParams.get("userId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (
      action &&
      !validActions.includes(
        action as (typeof validActions)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Invalid audit action." },
        { status: 400 }
      );
    }

    if (
      entityType &&
      !validEntityTypes.includes(
        entityType as (typeof validEntityTypes)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Invalid audit entity type." },
        { status: 400 }
      );
    }

    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (from) {
      fromDate = new Date(from);

      if (Number.isNaN(fromDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid start date." },
          { status: 400 }
        );
      }
    }

    if (to) {
      toDate = new Date(to);

      if (Number.isNaN(toDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid end date." },
          { status: 400 }
        );
      }

      // Include the complete end date when a date-only
      // value such as 2026-08-23 is supplied.
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        toDate.setHours(23, 59, 59, 999);
      }
    }

    if (fromDate && toDate && fromDate > toDate) {
      return NextResponse.json(
        {
          error:
            "Start date cannot be later than end date.",
        },
        { status: 400 }
      );
    }

    const where = {
      ...(action
        ? {
            action:
              action as (typeof validActions)[number],
          }
        : {}),

      ...(entityType
        ? {
            entityType:
              entityType as (typeof validEntityTypes)[number],
          }
        : {}),

      ...(userId
        ? {
            userId,
          }
        : {}),

      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate
                ? { gte: fromDate }
                : {}),
              ...(toDate
                ? { lte: toDate }
                : {}),
            },
          }
        : {}),
    };

    const totalRecords = await prisma.auditLog.count({
      where,
    });

    const totalPages =
      totalRecords === 0
        ? 0
        : Math.ceil(totalRecords / PAGE_SIZE);

    const safePage =
      totalPages > 0
        ? Math.min(page, totalPages)
        : 1;

    const auditLogs = await prisma.auditLog.findMany({
      where,

      orderBy: {
        createdAt: "desc",
      },

      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,

      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json({
      auditLogs,
      pagination: {
        page: safePage,
        pageSize: PAGE_SIZE,
        totalRecords,
        totalPages,
        hasNextPage:
          totalPages > 0 &&
          safePage < totalPages,
        hasPreviousPage: safePage > 1,
      },
    });
  } catch (error) {
    console.error(
      "Audit history lookup failed:",
      error
    );

    return NextResponse.json(
      { error: "Failed to load audit history." },
      { status: 500 }
    );
  }
}