import type { Metadata } from "next";
import { getGlobalHeadAdHtml } from "./ads/serverAdSettings";
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

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const globalHeadAdHtml = await getGlobalHeadAdHtml();

  return (
    <html lang="zh-Hant">
      <body>
        {globalHeadAdHtml ? <div hidden dangerouslySetInnerHTML={{ __html: globalHeadAdHtml }} /> : null}
        <FrontendInteractionGuard />
        <SiteAnalyticsTracker />
        {children}
      </body>
    </html>
  );
}
