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
        {
          error:
            "Admin access required.",
        },
        { status: 403 }
      );
    }

    const { id } = await params;

    const body = await request.json();

    const status = String(
      body.status ?? ""
    )
      .trim()
      .toUpperCase();

    if (
      status !== "ACTIVE" &&
      status !== "DEACTIVATED"
    ) {
      return NextResponse.json(
        {
          error:
            "Status must be ACTIVE or DEACTIVATED.",
        },
        { status: 400 }
      );
    }

    const employee =
      await prisma.employee.findUnique({
        where: {
          id,
        },
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          status: true,
        },
      });

    if (!employee) {
      return NextResponse.json(
        {
          error:
            "Employee not found.",
        },
        { status: 404 }
      );
    }

    if (
      employee.id === admin.id &&
      status === "DEACTIVATED"
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot deactivate your own account.",
        },
        { status: 409 }
      );
    }

    if (employee.status === status) {
      return NextResponse.json({
        message:
          status === "ACTIVE"
            ? "Employee is already active."
            : "Employee is already deactivated.",
        employee,
      });
    }

    const result =
      await prisma.$transaction(
        async (tx) => {
          const updatedEmployee =
            await tx.employee.update({
              where: {
                id,
              },
              data: {
                status:
                  status === "ACTIVE"
                    ? "ACTIVE"
                    : "DEACTIVATED",
              },
              select: {
                id: true,
                name: true,
                username: true,
                role: true,
                status: true,
              },
            });

          await createAuditLog(
            {
              userId: admin.id,
              action:
                status === "ACTIVE"
                  ? "REACTIVATE"
                  : "DEACTIVATE",
              entityType: "USER",
              entityId: employee.id,
              oldValue: {
                name: employee.name,
                username:
                  employee.username,
                role: employee.role,
                status: employee.status,
              },
              newValue: {
                name:
                  updatedEmployee.name,
                username:
                  updatedEmployee.username,
                role:
                  updatedEmployee.role,
                status:
                  updatedEmployee.status,
              },
            },
            tx
          );

          return updatedEmployee;
        }
      );

    return NextResponse.json({
      message:
        status === "ACTIVE"
          ? "Employee activated successfully."
          : "Employee deactivated successfully.",
      employee: result,
    });
  } catch (error) {
    console.error(
      "Employee status update failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to update employee status.",
      },
      { status: 500 }
    );
  }
}