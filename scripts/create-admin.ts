import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

const username = "HARIKARAN.R";
const password = "swp_h_2010";
const name = "Harikaran";

async function main() {
  const existing = await prisma.user.findUnique({
    where: { username },
  });

  if (existing) {
    console.log(`User ${username} already exists.`);
    return;
  }

  const result = await auth.api.signUpEmail({
    body: {
      email: `${username.toLowerCase().replace(/\./g, "_")}@swp.local`,
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

  console.log(`Admin ${username} created successfully.`);
}

main()
  .catch((error) => {
    console.error("Admin creation failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });