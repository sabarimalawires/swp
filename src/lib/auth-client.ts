import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: "https://swp-nine.vercel.app",
  plugins: [
    usernameClient({
      displayUsername: false,
    }),
  ],
});