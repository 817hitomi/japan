import type { Metadata } from "next";
import { FrontendInteractionGuard } from "./FrontendInteractionGuard";
import { SiteAnalyticsTracker } from "./SiteAnalyticsTracker";
import "./globals.scss";

export const metadata: Metadata = {
  title: "日文筆記 | JapanNote",
  description: "Next.js、SCSS、Supabase、Cloudflare Workers 打造的日文自學筆記。",
  icons: {
    icon: "/brand/logo_b.png",
    shortcut: "/brand/logo_b.png",
    apple: "/brand/logo_b.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>
        <FrontendInteractionGuard />
        <SiteAnalyticsTracker />
        {children}
      </body>
    </html>
  );
}
