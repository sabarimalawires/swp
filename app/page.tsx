"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/src/lib/auth-client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await authClient.signIn.username({
        username,
        password,
      });

      if (result.error) {
        setError(
          result.error.message || "Invalid username or password."
        );
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="relative h-[100dvh] min-h-0 w-full overflow-hidden bg-[#F2EAD2] bg-cover bg-center bg-no-repeat text-[#0B3829] lg:min-h-screen"
      style={{
        backgroundImage: "url('/login-background.png')",
      }}
    >
      {/* SUBTLE OVERLAY - BACKGROUND REMAINS VISIBLE */}
      <div className="absolute inset-0 bg-transparent" />

      {/* CIRCULAR SWP EMBLEM - LEFT SIDE */}
      <div className="absolute left-[5.5%] top-85 hidden -translate-y-1/2 items-center justify-center lg:flex">
        <img
          src="/swp-emblem.png"
          alt="Sabarimala Wire Products - Standard Fencing"
          className="w-[min(26vw,490px)] object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.25)]"
        />
      </div>

      {/* RIGHT SIDE CONTENT */}
<section className="relative z-10 mx-auto flex h-full min-h-0 w-full flex-col items-center justify-center gap-2 px-4 py-2 sm:px-6 lg:absolute lg:left-[47.5%] lg:top-0 lg:h-screen lg:w-[47%] lg:gap-0 lg:px-0 lg:py-0">
        {/* HORIZONTAL SWP BRANDING */}
        <div className="mb-2 flex w-full max-w-[680px] items-center justify-center sm:mb-4 lg:mb-7">
          <img
            src="/swp-logo.png"
            alt="Sabarimala Wire & Wire Products"
            className="h-auto max-h-[65px] w-full object-contain sm:max-h-[85px] lg:max-h-[145px]"
          />
        </div>

        {/* LOGIN CARD */}
<div className="w-full max-w-[680px] rounded-[24px] border border-[#E5D9BD] bg-[#FBF7EA]/95 px-5 py-4 shadow-[0_20px_55px_rgba(30,59,47,0.15)] backdrop-blur-sm sm:px-8 sm:py-6 lg:rounded-[30px] lg:px-11 lg:py-6">
          {/* MOBILE EMBLEM */}
          <div className="mb-3 flex justify-center lg:hidden">
            <img
              src="/swp-emblem.png"
              alt="SWP"
              className="h-14 w-14 object-contain sm:h-16 sm:w-16"
            />
          </div>

          {/* WELCOME HEADING */}
          <div className="mb-6 text-center">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-[#0B3829] sm:text-[48px]">
              Welcome Back
            </h1>

            {/* DOUBLE LINE SUBTITLE */}
            <div className="mt-3 flex items-center justify-center gap-5">
              <span className="h-px w-[58px] shrink-0 bg-[#718477]" />

              <p className="whitespace-nowrap text-xs font-medium text-[#1E3B2F] sm:text-base">
                Sign in to continue to SWP Management
              </p>

              <span className="h-px w-[58px] shrink-0 bg-[#718477]" />
            </div>
          </div>

          {/* LOGIN FORM */}
          <form onSubmit={handleLogin} className="space-y-5">

            {/* USERNAME */}
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-bold text-[#0B3829]"
              >
                Username
              </label>

              <div className="relative">
                <svg
                  className="absolute left-6 top-1/2 h-6 w-6 -translate-y-1/2 text-[#718477]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7" />
                </svg>

                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="Enter your username"
                  className="h-[54px] w-full rounded-2xl border border-[#E0D3B9] bg-[#FBF7EA] pl-16 pr-5 text-base text-[#0B3829] outline-none transition placeholder:text-[#89958B] focus:border-[#0B3829] focus:ring-4 focus:ring-[#0B3829]/10"
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-bold text-[#0B3829]"
              >
                Password
              </label>

              <div className="relative">
                <svg
                  className="absolute left-6 top-1/2 h-6 w-6 -translate-y-1/2 text-[#718477]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  <circle cx="12" cy="15" r="1" />
                  <path d="M12 16v2" />
                </svg>

                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="h-[60px] w-full rounded-2xl border border-[#E0D3B9] bg-[#FBF7EA] pl-16 pr-16 text-base text-[#0B3829] outline-none transition placeholder:text-[#89958B] focus:border-[#0B3829] focus:ring-4 focus:ring-[#0B3829]/10"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-6 top-1/2 -translate-y-1/2 text-xl text-[#1E3B2F] hover:text-[#0B3829]"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? "◉" : "◎"}
                </button>
              </div>
            </div>

            {/* FORGOT PASSWORD */}
            <div className="flex justify-end pt-1">
              <span className="text-sm font-medium text-[#1E3B2F]">
                Forgot password? Contact an Admin.
              </span>
            </div>

            {/* ERROR MESSAGE */}
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-700"
              >
                {error}
              </p>
            )}

            {/* SIGN IN BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="group flex h-[56px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#0B3829] to-[#0B3829] text-lg font-extrabold text-[#F2EAD2] shadow-[0_12px_30px_rgba(30,59,47,0.20)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_35px_rgba(30,59,47,0.30)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}

              {!loading && (
                <span className="text-2xl transition-transform group-hover:translate-x-2">
                  →
                </span>
              )}
            </button>
          </form>

          {/* DEVELOPER BRANDING */}
<div className="mt-6 border-t border-[#E0D3B9] pt-4">
  <a
    href="https://www.linkedin.com/in/ganesh-bp0810/"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Connect with Ganesh BP on LinkedIn"
    className="mx-auto block w-full max-w-[110px] transition duration-300 hover:scale-[1.025] sm:max-w-[230px] lg:max-w-[270px]"
  >
    <img
      src="/Ganesh_Branding.png"
      alt="Designed and developed by Ganesh"
      className="mx-auto h-auto max-h-[120px] w-full object-contain sm:max-h-[45px] lg:max-h-[58px]"
    />
  </a>
</div>
        </div>
      </section>
    </main>
  );
}
