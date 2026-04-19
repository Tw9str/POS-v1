import AdminDashboardClient from "./AdminDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return <AdminDashboardClient />;
}
