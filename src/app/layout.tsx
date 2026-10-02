import type { Metadata, Viewport } from "next";
import { PracticeBanner } from "@/components/PracticeBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "およげない！たいやきくん", template: "%s｜およげない！たいやきくん" },
  description: "寮祭たい焼き屋台の注文管理",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <PracticeBanner />
        {children}
      </body>
    </html>
  );
}
