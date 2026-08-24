"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";

const adminNavigation = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Employees", href: "/employees" },
  { name: "Work Entries", href: "/work" },
  { name: "Inventory", href: "/inventory" },
  { name: "Sales", href: "/sales" },
  { name: "Customers", href: "/customers"},
  { name: "History", href: "/history"},
  { name: "Reports", href: "/reports" },
  { name: "Products", href: "/products"},
];

const workerNavigation = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Work Entries", href: "/work" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [role, setRole] = useState<"ADMIN" | "WORKER" | null>(null);
  useEffect(() => {
  const loadEmployee = async () => {
    const response = await fetch("/api/me/employee");

    if (!response.ok) {
      return;
    }

    const employee = await response.json();
    setRole(employee.role);
  };

  loadEmployee();
}, []);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
  };

  return (
    <aside className="flex min-h-screen w-64 flex-col border-r border-[#f1dfd2] bg-white">
      <div className="border-b border-[#f1dfd2] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff1e6] font-bold text-[#d96f2b]">
            S
          </div>

          <div>
            <h1 className="font-bold text-[#3b2117]">SWP</h1>
            <p className="text-xs text-[#a66a4a]">Business Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-2 p-4">
        {(role === "ADMIN" ? adminNavigation : workerNavigation).map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${
                active
                  ? "bg-[#d96f2b] text-white"
                  : "text-[#5b2f1f] hover:bg-[#fff1e6]"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#f1dfd2] p-4">
        <button
          onClick={handleSignOut}
          className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-[#a64b2b] hover:bg-[#fff1e6]"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}