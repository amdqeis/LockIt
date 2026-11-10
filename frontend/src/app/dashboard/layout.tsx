"use client";

import { usePathname } from "next/navigation";
import { Dashboard } from "@/components/dashboard/Dashboard";
import "./dashboard.css";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPreview = pathname.startsWith("/dashboard/preview");

  if (isPreview) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <Dashboard />
    </>
  );
}
