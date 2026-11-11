
import { createInterface } from "node:readline";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

async function main() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const password = await new Promise<string>((resolve) => {
      rl.question("Enter a new admin password: ", resolve);
    });

    if (password.length < 8) {
      throw new Error("Password must contain at least 8 characters.");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: "hari@swp.com" },
    });

    if (existingUser) {
      throw new Error("This email already exists. No account was created.");
    }

    const result = await auth.api.signUpEmail({
      body: {
        name: "Harikaran",
        email: "hari@swp.com",
        username: "harikaran.r",
        password,
      },
    });

    const user = result.user;

    await prisma.employee.create({
      data: {
        authUserId: user.id,
        username: "harikaran.r",
        name: "Harikaran",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    console.log("Local admin account created successfully.");
    console.log("Username: harikaran.r");
    console.log("Email: hari@swp.com");
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Admin creation failed:", error);
  process.exitCode = 1;
});
