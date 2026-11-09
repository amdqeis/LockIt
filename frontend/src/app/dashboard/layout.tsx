import { Dashboard } from "@/components/dashboard/Dashboard";
import "./dashboard.css";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<Dashboard /></>;
}
