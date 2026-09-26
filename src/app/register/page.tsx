import type { Metadata } from "next";
import { RegisterScreen } from "./RegisterScreen";

export const metadata: Metadata = { title: "レジ｜たいやきくん" };

export default function RegisterPage() {
  return <RegisterScreen />;
}
