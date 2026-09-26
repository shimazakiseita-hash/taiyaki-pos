import type { Metadata } from "next";
import { DisplayScreen } from "./DisplayScreen";

export const metadata: Metadata = { title: "呼び出し" };

export default function DisplayPage() {
  return <DisplayScreen />;
}
