import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { requireAdmin } from "@/src/lib/authorization";
import { prisma } from "@/src/lib/prisma";
import { createAuditLog } from "@/src/lib/audit";

export async function POST(request: Request) {
  try {
    const currentEmployee = await requireAdmin(request);

    if (!currentEmployee) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const username = String(body.username ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");

    if (!name || !username || !password) {
      return NextResponse.json(
        {
          error:
            "Name, username and password are required.",
        },
        { status: 400 }
      );
    }

    if (name.length < 2) {
      return NextResponse.json(
        {
          error:
            "Employee name must be at least 2 characters.",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const existingEmployee =
      await prisma.employee.findUnique({
        where: {
          username,
        },
      });

    if (existingEmployee) {
      return NextResponse.json(
        {
          error: "Username already exists.",
        },
        { status: 409 }
      );
    }

    const email = `${username.replace(
      /[^a-z0-9]/g,
      "_"
    )}@swp.local`;

    const existingUser =
      await prisma.user.findUnique({
        where: {
          email,
        },
      });

    if (existingUser) {
      return NextResponse.json(
        {
          error:
            "Authentication account already exists.",
        },
        { status: 409 }
      );
    }

    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    });

    if (!result?.user) {
      throw new Error(
        "Authentication account could not be created."
      );
    }

    try {
      await prisma.user.update({
        where: {
          id: result.user.id,
        },
        data: {
          username,
        },
      });

      const employee =
        await prisma.employee.create({
          data: {
            authUserId: result.user.id,
            username,
            name,
            role: "WORKER",
            status: "ACTIVE",
          },
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
            status: true,
          },
        });

      await createAuditLog({
        userId: currentEmployee.id,
        action: "CREATE",
        entityType: "USER",
        entityId: employee.id,
        oldValue: null,
        newValue: {
          name: employee.name,
          username: employee.username,
          role: employee.role,
          status: employee.status,
        },
      });

      return NextResponse.json(
        {
          message:
            "Employee created successfully.",
          employee,
        },
        { status: 201 }
      );
    } catch (error) {
      await prisma.user.delete({
        where: {
          id: result.user.id,
        },
      });

      throw error;
    }
  } catch (error) {
    console.error(
      "Employee creation failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to create employee.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
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

    const employees =
      await prisma.employee.findMany({
        select: {
          id: true,
          name: true,
          username: true,
          role: true,
          status: true,
        },
        orderBy: {
          name: "asc",
        },
      });

    return NextResponse.json(
      employees
    );
  } catch (error) {
    console.error(
      "Employees lookup failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load employees.",
      },
      { status: 500 }
    );
  }
}