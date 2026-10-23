
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

const admins = [
  {
    username: "HARIKARAN.R",
    password: "swp_h_2010",
    name: "Harikaran",
  },
  {
    username: "Raman.L",
    password: "swp_r_2010",
    name: "Raman L",
  },
  {
    username: "Seetha",
    password: "swp_s_2010",
    name: "Seetha",
  },
];

async function main() {
  for (const admin of admins) {
    const { username, password, name } = admin;
    const email =
      `${username.toLowerCase().replace(/\./g, "_")}@swp.local`;

    // Check usernames case-insensitively.
    const existingUser = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
    });

    // Also check the generated email.
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log(
        `${username}: user already exists; leaving it unchanged.`
      );
      continue;
    }

    if (existingEmail) {
      console.warn(
        `${username}: email ${email} already belongs to a user. ` +
          "Skipping to avoid creating a duplicate."
      );
      continue;
    }

    const result = await auth.api.signUpEmail({
      body: { email, password, name },
    });

    if (!result?.user) {
      throw new Error(
        `Failed to create authentication account for ${username}.`
      );
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: result.user.id },
          data: { username },
        });

        await tx.employee.create({
          data: {
            authUserId: result.user.id,
            username,
            name,
            role: "ADMIN",
            status: "ACTIVE",
          },
        });
      });

      console.log(`${username}: admin created successfully.`);
    } catch (error) {
      console.error(
        `${username}: authentication account was created, ` +
          "but employee setup failed. Check the database before retrying.",
        error
      );
      throw error;
    }
  }
}

main()
  .catch((error) => {
    console.error("Admin creation failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
