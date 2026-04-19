import SubscriptionsClient from "./SubscriptionsClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Subscriptions" };

export default function SubscriptionsPage() {
  return <SubscriptionsClient />;
}
