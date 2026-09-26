import type { Metadata } from "next";
import { AdminScreen } from "./AdminScreen";

export const metadata: Metadata = { title: "管理" };

export default function AdminPage() {
  return <AdminScreen />;
}
