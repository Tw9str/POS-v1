import MerchantsClient from "./MerchantsClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Merchants" };

export default function MerchantsPage() {
  return <MerchantsClient />;
}
