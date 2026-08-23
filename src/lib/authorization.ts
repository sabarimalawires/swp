import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function getCurrentEmployee(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return null;
  }

  const employee = await prisma.employee.findUnique({
    where: {
      authUserId: session.user.id,
    },
    select: {
      id: true,
      authUserId: true,
      username: true,
      name: true,
      role: true,
      status: true,
    },
  });

  if (!employee || employee.status !== "ACTIVE") {
    return null;
  }

  return employee;
}

export async function requireAdmin(request: Request) {
  const employee = await getCurrentEmployee(request);

  if (!employee || employee.role !== "ADMIN") {
    return null;
  }

  return employee;
}