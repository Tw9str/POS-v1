import ActivityClient from "./ActivityClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Activity Log" };

export default function ActivityPage() {
  return <ActivityClient />;
}
