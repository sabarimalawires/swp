import { hashPassword } from "better-auth/crypto";
import { prisma } from "../src/lib/prisma";

const username = "harikaran.r";
const password = process.env.ADMIN_PASSWORD;

async function main() {
  if (!password || password.length < 8) {
    throw new Error(
      "ADMIN_PASSWORD must be set to a password of at least 8 characters."
    );
  }

  const admin = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      employee: {
        select: {
          role: true,
          status: true,
        },
      },
      accounts: {
        where: { providerId: "credential" },
        select: { id: true },
      },
    },
  });

  if (!admin?.employee || admin.employee.role !== "ADMIN") {
    throw new Error("Active admin account was not found.");
  }

  if (admin.employee.status !== "ACTIVE") {
    throw new Error("The admin account is not active.");
  }

  if (admin.accounts.length !== 1) {
    throw new Error("Admin credential account was not found.");
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.account.update({
      where: { id: admin.accounts[0].id },
      data: { password: passwordHash },
    }),
    prisma.session.deleteMany({
      where: { userId: admin.id },
    }),
  ]);

  console.log("Admin password reset completed successfully.");
}

main()
  .catch((error) => {
    console.error(
      "Admin password reset failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
