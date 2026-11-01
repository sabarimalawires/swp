
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Package,
  ShoppingCart,
  UserRound,
  History,
  ChartNoAxesCombined,
  BookOpen,
  PackageSearch,
  Menu,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import { authClient } from "@/src/lib/auth-client";

const adminNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Employees", href: "/employees", icon: Users },
  { name: "Work Entries", href: "/work", icon: ClipboardList },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Sales", href: "/sales", icon: ShoppingCart },
  { name: "Customers", href: "/customers", icon: UserRound },
  { name: "History", href: "/history", icon: History },
  { name: "Reports", href: "/reports", icon: ChartNoAxesCombined },
  { name: "Ledger", href: "/ledger", icon: BookOpen },
  { name: "Products", href: "/products", icon: PackageSearch },
];

const workerNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Work Entries", href: "/work", icon: ClipboardList },
];

const mobileAdminNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: "⌂" },
  { name: "Sales", href: "/sales", icon: "🛒" },
  { name: "Customers", href: "/customers", icon: "♙" },
  { name: "Ledger", href: "/ledger", icon: "▤" },
];

const mobileWorkerNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: "⌂" },
  { name: "Work Entries", href: "/work", icon: "▣" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [role, setRole] = useState<"ADMIN" | "WORKER" | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const loadEmployee = async () => {
      try {
        const response = await fetch("/api/me/employee", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const employee = await response.json();

        setRole(employee.role);
        setEmployeeName(employee.name || employee.username || "");
      } catch (error) {
        console.error("Failed to load employee details:", error);
      }
    };

    loadEmployee();
  }, []);

  useEffect(() => {
    setShowMore(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
  };

  const navigation =
    role === "ADMIN" ? adminNavigation : workerNavigation;

  const mobileNavigation =
    role === "ADMIN"
      ? mobileAdminNavigation
      : mobileWorkerNavigation;

  const moreNavigation =
    role === "ADMIN"
      ? adminNavigation.filter(
          (item) =>
            !mobileAdminNavigation.some(
              (mainItem) => mainItem.href === item.href
            )
        )
      : [];

  const profileInitial = employeeName
    ? employeeName.trim().charAt(0).toUpperCase()
    : "U";

  return (
    <>
      {/* MOBILE HEADER */}
      <header className="swp-mobile-header fixed left-0 right-0 top-0 z-[60] flex h-[68px] items-center justify-between border-b border-[#f1dfd2] bg-[#fffaf5] px-4 md:hidden">
        <div className="flex items-center gap-3">
          <img
            src="/ledger-watermark-logo.png"
            alt="SWP Logo"
            className="h-11 w-11 rounded-full object-contain"
          />

          <div className="leading-tight">
            <h1 className="text-[17px] font-bold text-[#3b2117]">
              SWP
            </h1>
            <p className="mt-1 text-[11px] text-[#a66a4a]">
              Business Management
            </p>
          </div>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d96f2b] text-sm font-bold text-white shadow-sm">
          {profileInitial}
        </div>
      </header>

      {/* DESKTOP COLLAPSIBLE SIDEBAR */}
      <aside
        className={`swp-sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[#f1dfd2] bg-white transition-[width] duration-300 ease-in-out md:flex ${
          collapsed ? "w-[76px]" : "w-64"
        }`}
      >
        {/* BRAND AND TOGGLE */}
        <div
          className={`flex min-h-[100px] items-center border-b border-[#f1dfd2] ${
            collapsed
              ? "flex-col justify-center gap-2 px-2 py-3"
              : "justify-between gap-2 p-5"
          }`}
        >
          <div
            className={`flex min-w-0 items-center ${
              collapsed ? "justify-center" : "gap-3"
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff1e6]">
              <img
                src="/ledger-watermark-logo.png"
                alt="SWP Logo"
                className="h-10 w-10 object-contain"
              />
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <h1 className="font-bold text-[#3b2117]">SWP</h1>
                <p className="whitespace-nowrap text-xs text-[#a66a4a]">
                  Business Management
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#8b5940] transition hover:bg-[#fff1e6] hover:text-[#d96f2b]"
          >
            {collapsed ? (
              <Menu size={21} />
            ) : (
              <ChevronLeft size={21} />
            )}
          </button>
        </div>

        {/* DESKTOP NAVIGATION */}
        <nav
          className={`flex-1 space-y-2 overflow-y-auto overflow-x-hidden py-4 ${
            collapsed ? "px-2" : "px-4"
          }`}
        >
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.name : undefined}
                aria-label={item.name}
                className={`group flex min-h-12 items-center rounded-xl text-sm font-medium transition-all duration-200 ${
                  collapsed
                    ? "justify-center px-2"
                    : "gap-3 px-4"
                } ${
                  active
                    ? "bg-[#d96f2b] text-white shadow-sm"
                    : "text-[#5b2f1f] hover:bg-[#fff1e6] hover:text-[#d96f2b]"
                }`}
              >
                <Icon
                  size={21}
                  strokeWidth={active ? 2.4 : 1.9}
                  className="shrink-0"
                />

                {!collapsed && (
                  <span className="truncate">{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* SIGN OUT */}
        <div
          className={`border-t border-[#f1dfd2] py-4 ${
            collapsed ? "px-2" : "px-4"
          }`}
        >
          <button
            type="button"
            onClick={handleSignOut}
            title={collapsed ? "Sign out" : undefined}
            aria-label="Sign out"
            className={`flex min-h-12 w-full items-center rounded-xl text-sm font-medium text-[#a64b2b] transition hover:bg-[#fff1e6] ${
              collapsed
                ? "justify-center px-2"
                : "gap-3 px-4"
            }`}
          >
            <LogOut size={21} className="shrink-0" />

            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION */}
      <div className="fixed bottom-0 left-0 z-50 w-full border-t border-[#f1dfd2] bg-white md:hidden">
        {showMore && (
          <>
            <button
              aria-label="Close more menu"
              onClick={() => setShowMore(false)}
              className="fixed inset-0 z-40 bg-black/20"
            />

            <div className="absolute bottom-full right-3 z-50 mb-3 w-60 overflow-hidden rounded-2xl border border-[#f1dfd2] bg-white p-2 shadow-xl">
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#a66a4a]">
                More options
              </p>

              {moreNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-xl px-4 py-3 text-sm font-medium ${
                    pathname === item.href
                      ? "bg-[#fff1e6] text-[#d96f2b]"
                      : "text-[#5b2f1f] hover:bg-[#fff8f2]"
                  }`}
                >
                  {item.name}
                </Link>
              ))}

              <div className="my-2 border-t border-[#f1dfd2]" />

              <button
                onClick={handleSignOut}
                className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-[#c0392b] hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          </>
        )}

        <nav
          className="grid items-center px-1 py-2"
          style={{
            gridTemplateColumns: `repeat(${role === "ADMIN" ? 5 : 3}, minmax(0, 1fr))`,
          }}
        >
          {mobileNavigation.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-center transition ${
                  active ? "text-[#d96f2b]" : "text-[#596273]"
                }`}
              >
                <span className="text-2xl leading-none">
                  {item.icon}
                </span>

                <span className="text-[10px] font-medium">
                  {item.name}
                </span>
              </Link>
            );
          })}

          {role === "ADMIN" && (
            <button
              onClick={() => setShowMore((current) => !current)}
              className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl ${
                showMore ||
                moreNavigation.some(
                  (item) => item.href === pathname
                )
                  ? "text-[#d96f2b]"
                  : "text-[#596273]"
              }`}
            >
              <span className="text-2xl leading-none">•••</span>
              <span className="text-[10px] font-medium">More</span>
            </button>
          )}

          {role !== "ADMIN" && (
            <button
              onClick={handleSignOut}
              className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-[#596273]"
            >
              <span className="text-2xl leading-none">↪</span>
              <span className="text-[10px] font-medium">
                Sign out
              </span>
            </button>
          )}
        </nav>
      </div>
    </>
  );
}
