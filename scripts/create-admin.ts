
import "dotenv/config";
import { auth } from "../src/lib/auth";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../src/lib/prisma";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is missing");

  const host = new URL(dbUrl).hostname;
  if (!host.includes("ep-withered-haze-azl97vog")) {
    throw new Error("STOP: Not connected to the expected production Neon database.");
  }

  const ramanPassword = process.env.RAMAN_NEW_PASSWORD;
  const seethaPassword = process.env.SEETHA_NEW_PASSWORD;

  if (!ramanPassword || !seethaPassword) {
    throw new Error("Set both new password environment variables first.");
  }

  // Raman: repair his existing credential.
  const raman = await prisma.user.findFirst({
    where: { username: { equals: "raman.l", mode: "insensitive" } },
  });
  if (!raman) throw new Error("Raman auth user not found");

  const ramanAccount = await prisma.account.findFirst({
    where: { userId: raman.id, providerId: "credential" },
  });
  if (!ramanAccount) throw new Error("Raman credential account not found");

  const ramanEmployee = await prisma.employee.findFirst({
    where: { username: { equals: "raman.l", mode: "insensitive" } },
  });
  if (!ramanEmployee || ramanEmployee.authUserId !== raman.id) {
    throw new Error("Raman employee link does not match");
  }

  // Seetha: create her auth account only if it is absent.
  let seetha = await prisma.user.findFirst({
    where: { username: { equals: "seetha", mode: "insensitive" } },
  });

  if (!seetha) {
    const emailOwner = await prisma.user.findUnique({
      where: { email: "seetha@swp.local" },
    });
    if (emailOwner) throw new Error("Seetha's email is already in use");

    const result = await auth.api.signUpEmail({
      body: {
        email: "seetha@swp.local",
        password: seethaPassword,
        name: "Seetha",
      },
    });

    if (!result?.user) throw new Error("Could not create Seetha's auth user");

    seetha = await prisma.user.update({
      where: { id: result.user.id },
      data: { username: "seetha" },
    });
  } else {
    throw new Error(
      "Seetha's auth user already exists. Stop and inspect it before retrying."
    );
  }

  // Check employee identity before any employee writes.
  const seethaEmployee = await prisma.employee.findFirst({
    where: { username: { equals: "seetha", mode: "insensitive" } },
  });
  if (seethaEmployee && seethaEmployee.authUserId !== seetha.id) {
    throw new Error("Seetha employee record is linked to another user");
  }

  // Repair Raman's credential with Better Auth's own hash function.
  await prisma.account.update({
    where: { id: ramanAccount.id },
    data: { password: await hashPassword(ramanPassword) },
  });

  await prisma.employee.update({
    where: { id: ramanEmployee.id },
    data: { role: "ADMIN", status: "ACTIVE" },
  });

  // Link Seetha to her new auth user.
  if (!seethaEmployee) {
    await prisma.employee.create({
      data: {
        authUserId: seetha.id,
        username: "seetha",
        name: "Seetha",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
  }

  console.log("Raman credential repaired; Seetha account created.");
  console.log("Harikaran was not modified.");
}

main()
  .catch((error) => {
    console.error("Repair failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
