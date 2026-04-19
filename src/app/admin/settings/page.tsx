import type { Metadata } from "next";
import SettingsContent from "./SettingsContent";

export const metadata: Metadata = { title: "System Settings" };

export default function AdminSettingsPage() {
  return <SettingsContent />;
}
