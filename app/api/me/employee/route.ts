import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: {
        authUserId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        status: true,
      },
    });

    if (!employee || employee.status !== "ACTIVE") {
  return NextResponse.json(
    { error: "Employee access required." },
    { status: 403 }
  );
}

    return NextResponse.json(employee);
  } catch (error) {
    console.error("Employee lookup failed:", error);

    return NextResponse.json(
      { error: "Failed to load employee information." },
      { status: 500 }
    );
  }
}