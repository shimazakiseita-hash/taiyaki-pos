import type { Metadata } from "next";
import { RegisterScreen } from "./RegisterScreen";

export const metadata: Metadata = { title: "レジ" };

export default function RegisterPage() {
  return <RegisterScreen />;
}
