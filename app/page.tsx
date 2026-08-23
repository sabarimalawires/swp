"use client";

import { useState } from "react"; 
import { authClient } from "@/src/lib/auth-client";
import { useRouter } from "next/navigation";

export default function Home() {
const [showPassword, setShowPassword] = useState(false);
const [username, setUsername] = useState("");
const [password, setPassword] = useState("");
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

const router = useRouter();
  return (
    <main className="min-h-screen bg-[#FFF8F2] text-[#3F2418]">
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="flex w-full max-w-6xl overflow-hidden rounded-[32px] border border-[#F3DCC9] bg-[#FFFCF9] shadow-[0_24px_80px_rgba(91,52,31,0.12)]">

          {/* Left - Login */}
          <section className="flex w-full flex-col justify-center px-6 py-10 sm:px-12 lg:w-1/2 lg:px-20 lg:py-16">
            
            {/* Logo */}
            <div className="mb-12">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FCE3D0]">
                  <span className="text-xl font-bold text-[#C8652C]">S</span>
                </div>

                <span className="text-2xl font-bold tracking-tight text-[#4A281A]">
                  SWP
                </span>
              </div>

              <p className="text-sm text-[#8B6B5A]">
                Business Management System
              </p>
            </div>

            {/* Heading */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-[#3F2418] sm:text-4xl">
                Welcome back!
              </h1>

              <p className="mt-3 text-sm leading-6 text-[#8B6B5A]">
                Sign in to manage your business activities.
              </p>
            </div>

            {/* Form */}
            <form
  className="space-y-5"
  onSubmit={async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await authClient.signIn.username({
      username,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message || "Invalid username or password.");
      return;
    }

    router.push("/dashboard");
  }}
>
              
              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-sm font-semibold text-[#5B3928]"
                >
                  Username
                </label>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#B28C76]">
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M20 21a8 8 0 0 0-16 0" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>

                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="Enter your username"
                    className="h-14 w-full rounded-2xl border border-[#E8D4C5] bg-[#FFFDFB] pl-12 pr-4 text-sm text-[#3F2418] outline-none transition placeholder:text-[#B9A093] focus:border-[#D9793A] focus:ring-4 focus:ring-[#FCE3D0]"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-[#5B3928]"
                >
                  Password
                </label>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#B28C76]">
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <rect x="4" y="10" width="16" height="11" rx="2" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>
                  </div>

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="h-14 w-full rounded-2xl border border-[#E8D4C5] bg-[#FFFDFB] pl-12 pr-12 text-sm text-[#3F2418] outline-none transition placeholder:text-[#B9A093] focus:border-[#D9793A] focus:ring-4 focus:ring-[#FCE3D0]"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-4 flex items-center text-[#B28C76] transition hover:text-[#C8652C]"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg
                        width="19"
                        height="19"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.5 4 9.5 6-.4.8-1.3 2.1-2.7 3.3" />
                        <path d="M6.6 6.6C4.8 7.7 3.5 9.3 2.5 10c1 2 4.5 6 9.5 6 1.1 0 2.1-.2 3-.5" />
                      </svg>
                    ) : (
                      <svg
                        width="19"
                        height="19"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                        <circle cx="12" cy="12" r="2.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Password help */}
              <div className="flex justify-end">
                <span className="text-xs text-[#9A7967]">
                  Forgot your password? Contact an Admin.
                </span>
              </div>

              {/* Login */}
              {error && (
                <p className="text-sm text-red-600">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="h-14 w-full rounded-2xl bg-[#D9793A] text-sm font-bold text-white shadow-[0_10px_24px_rgba(217,121,58,0.22)] transition hover:bg-[#C8652C] hover:shadow-[0_12px_28px_rgba(217,121,58,0.28)] active:scale-[0.99]"
              >
                {loading ? "Signing in..." : "Sign in"}              
                </button>
            </form>

            {/* Footer */}
            <p className="mt-10 text-center text-xs text-[#A58A7A]">
              Secure business access • SWP
            </p>
          </section>

          {/* Right - Visual */}
          <section className="relative hidden min-h-[650px] w-1/2 overflow-hidden bg-[#FCE3D0] lg:block">
            
            {/* Decorative circles */}
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#F8C9A9]" />
            <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-[#F8D7BF]" />

            <div className="relative flex h-full flex-col items-center justify-center px-14">
              
              {/* Main illustration area */}
              <div className="relative flex h-[420px] w-full max-w-md items-center justify-center rounded-[40px] bg-[#F9D8BD]">
                
                {/* Decorative dashboard card */}
                <div className="absolute left-8 top-12 w-44 rounded-2xl bg-[#FFFCF9] p-4 shadow-[0_18px_40px_rgba(91,52,31,0.12)]">
                  <div className="mb-3 h-2 w-20 rounded-full bg-[#E9C7B0]" />
                  <div className="mb-2 h-7 w-28 rounded-lg bg-[#FCE3D0]" />
                  <div className="h-2 w-16 rounded-full bg-[#EBDDD4]" />
                </div>

                {/* Person-style illustration */}
                <div className="relative z-10 mt-12 flex flex-col items-center">
                  <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-[#EFC1A0]">
                    <div className="h-20 w-20 rounded-full bg-[#5A3425]" />
                    <div className="absolute top-12 h-10 w-16 rounded-b-full bg-[#F1B78F]" />
                  </div>

                  <div className="mt-[-10px] h-40 w-44 rounded-t-[70px] bg-[#F7F2ED] shadow-lg" />

                  {/* Laptop */}
                  <div className="absolute bottom-2 left-1/2 w-64 -translate-x-1/2">
                    <div className="h-28 rounded-xl border-[6px] border-[#D6D0CA] bg-[#EEEAE5] shadow-lg">
                      <div className="m-3 h-[78px] rounded-lg bg-[#FFF8F2]">
                        <div className="flex gap-2 p-3">
                          <div className="h-3 w-12 rounded bg-[#F6D7C0]" />
                          <div className="h-3 w-8 rounded bg-[#E8B996]" />
                        </div>
                        <div className="mx-3 h-2 rounded bg-[#F1E1D6]" />
                        <div className="mx-3 mt-2 h-2 w-3/4 rounded bg-[#F1E1D6]" />
                      </div>
                    </div>

                    <div className="mx-auto h-2 w-72 rounded-b-full bg-[#B8B0AA]" />
                  </div>
                </div>
              </div>

              {/* Text */}
              <div className="mt-10 max-w-md text-center">
                <h2 className="text-3xl font-bold tracking-tight text-[#4A281A]">
                  Manage everything,
                  <br />
                  all in one place.
                </h2>

                <p className="mt-4 text-sm leading-6 text-[#8B604A]">
                  Track work, manage inventory, record sales and
                  keep your business operations organized with SWP.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}