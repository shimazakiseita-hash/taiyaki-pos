import type { Metadata } from "next";
import { KitchenScreen } from "./KitchenScreen";

export const metadata: Metadata = { title: "キッチン｜たいやきくん" };

export default function KitchenPage() {
  return <KitchenScreen />;
}
