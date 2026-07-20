import type { Metadata } from "next";
import { getGlobalHeadAdHtml } from "./ads/serverAdSettings";
import { FrontendInteractionGuard } from "./FrontendInteractionGuard";
import { SiteAnalyticsTracker } from "./SiteAnalyticsTracker";
import { createRequestTimer } from "../lib/requestDiagnostics";
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

export const revalidate = 300;

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const timer = createRequestTimer("layout", { route: "root" });
  const globalHeadAdHtml = await getGlobalHeadAdHtml();
  timer.end({ globalHeadAd: Boolean(globalHeadAdHtml) });

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
