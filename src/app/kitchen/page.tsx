import type { Metadata } from "next";
import { KitchenScreen } from "./KitchenScreen";

export const metadata: Metadata = { title: "キッチン" };

export default function KitchenPage() {
  return <KitchenScreen />;
}
