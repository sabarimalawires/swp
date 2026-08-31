import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

const username = "harikaran.r";
const name = "Harikaran";
const password = process.env.ADMIN_PASSWORD;

async function main() {
  if (!password || password.length < 8) {
    throw new Error(
      "ADMIN_PASSWORD must be set to a password of at least 8 characters."
    );
  }

  const existing = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      employee: {
        select: {
          id: true,
        },
      },
    },
  });

  if (existing) {
    if (!existing.employee) {
      await prisma.employee.create({
        data: {
          authUserId: existing.id,
          username,
          name,
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
    }

    console.log("Admin bootstrap already completed.");
    return;
  }

  const result = await auth.api.signUpEmail({
    body: {
      email: `${username.replace(/\./g, "_")}@swp.local`,
      password,
      name,
    },
  });

  if (!result?.user) {
    throw new Error("Failed to create the Admin authentication account.");
  }

  await prisma.user.update({
    where: { id: result.user.id },
    data: {
      username,
    },
  });

  await prisma.employee.create({
  data: {
    authUserId: result.user.id,
    username,
    name,
    role: "ADMIN",
    status: "ACTIVE",
  },
});

  console.log("Admin bootstrap completed successfully.");
}

main()
  .catch((error) => {
    console.error("Admin creation failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
