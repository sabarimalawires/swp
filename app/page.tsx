
"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/src/lib/auth-client";
import { useRouter } from "next/navigation";

export default function Home() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showIntro, setShowIntro] = useState(true);

useEffect(() => {
  const timer = window.setTimeout(() => {
    setShowIntro(false);
  }, 1550);

  return () => window.clearTimeout(timer);
}, []);
  const router = useRouter();

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-cover bg-center bg-no-repeat text-white"
      style={{ backgroundImage: "url('/Golden Hour Fence Line.png')" }}
    >

      {/* Cinematic opening animation */}
{showIntro && (
  <div className="login-intro" aria-hidden="true">
    <div className="intro-panel intro-panel-top" />
    <div className="intro-panel intro-panel-bottom" />
    <div className="intro-white-line" />
  </div>
)}
      {/* Dark cinematic overlay */}
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-black/65" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-8">
        <div className="grid w-full max-w-[1500px] items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">

          {/* LEFT BRANDING */}
<section className="hidden min-h-[78vh] flex-col justify-between px-6 lg:flex xl:px-14">

  <img
    src="/company-brand.png"
    alt="Sabarimala Wire Products"
    className="w-full max-w-[630px] object-contain d  rop-shadow-2xl transition-all duration-700 hover:scale-[1.03] hover:drop-shadow-[0_0_30px_rgba(249,115,22,0.4)]"
  />

  {/* FEATURES AT THE BOTTOM */}
  <div className="mt-auto grid max-w-[650px] grid-cols-3 divide-x divide-white/40 pt-16">

    {[
      { icon: "◈", title: "STRONGER", sub: "PERIMETERS" },
      { icon: "⚙", title: "RELIABLE", sub: "SOLUTIONS" },
      { icon: "♧", title: "TRUSTED", sub: "PARTNER" },
    ].map((item) => (
      <div
        key={item.title}
        className="group cursor-default px-5 py-5 text-center transition-all duration-300 hover:-translate-y-3"
      >
        <div className="mb-4 text-4xl text-orange-400 transition-all duration-300 group-hover:scale-125 group-hover:text-amber-300 group-hover:drop-shadow-[0_0_12px_rgba(251,146,60,0.8)]">
          {item.icon}
        </div>

        <p className="text-sm font-bold tracking-[0.16em] transition-colors duration-300 group-hover:text-orange-300">
          {item.title}
        </p>

        <p className="text-sm font-bold tracking-[0.16em] transition-colors duration-300 group-hover:text-orange-300">
          {item.sub}
        </p>
      </div>
    ))}

  </div>
</section>

          {/* LOGIN PANEL */}
          <section className="mx-auto w-full max-w-[570px] rounded-[30px] border border-orange-400/50 bg-[#101418]/85 p-7 shadow-[0_25px_100px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-10 lg:p-12">

            {/* Mobile logo */}
            <div className="mb-7 text-center lg:hidden">
              <img
                src="/company-brand.png"
                alt="SWP"
                className="mx-auto mb-5 max-h-24 max-w-full object-contain"
              />
            </div>

            <div className="mb-10 text-center">
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                Welcome <span className="text-orange-500">Back</span>
              </h1>
              <p className="mt-3 text-sm text-gray-300 sm:text-base">
                Sign in to continue to SWP Management
              </p>
            </div>

            <form
              className="space-y-6"
              onSubmit={async (e) => {
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
                      result.error.message ||
                        "Invalid username or password."
                    );
                    return;
                  }

                  router.push("/dashboard");
                } catch {
                  setError("Unable to sign in. Please try again.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-semibold text-gray-200"
                >
                  Username
                </label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-orange-400">
                    ♙
                  </span>

                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="Enter your username"
                    className="h-16 w-full rounded-2xl border border-white/25 bg-white/[0.06] pl-12 pr-4 text-white outline-none transition placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-gray-200"
                >
                  Password
                </label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-orange-400">
                    ♙
                  </span>

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="h-16 w-full rounded-2xl border border-white/25 bg-white/[0.06] pl-12 pr-14 text-white outline-none transition placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-gray-300 hover:text-orange-400"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "◉" : "◎"}
                  </button>
                </div>
              </div>

              {/* Forgot password */}
              <div className="flex justify-end">
                <span className="text-sm text-orange-400">
                  Forgot password? Contact an Admin.
                </span>
              </div>

              {error && (
                <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">
                  {error}
                </p>
              )}

              {/* Sign in */}
              <button
                type="submit"
                disabled={loading}
                className="group flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 text-base font-extrabold text-black shadow-[0_10px_35px_rgba(249,115,22,0.3)] transition hover:scale-[1.015] hover:shadow-[0_12px_40px_rgba(249,115,22,0.45)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign In"}
                {!loading && (
                  <span className="text-xl transition-transform group-hover:translate-x-1">
                    →
                  </span>
                )}
              </button>
            </form>

            
{/* Developer branding */}
<div className="mt-8 border-t border-white/15 pt-6">
  <a
    href="https://www.linkedin.com/in/ganesh-bp0810/"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Connect with Ganesh BP on LinkedIn"
    className="mx-auto block w-full max-w-[233px] overflow-hidden transition duration-300 hover:scale-[1.03]"
  >
    <div className="aspect-[3.2/1] w-full overflow-hidden">
      <img
        src="/Ganesh_Branding.png"
        alt="Designed and developed by Ganesh"
        className="h-full w-full object-cover object-center"
      />
    </div>
  </a>
</div>

          </section>
        </div>
      </div>
    </main>
  );
}
