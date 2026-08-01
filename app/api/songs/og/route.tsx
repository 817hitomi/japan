import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getRuntimeEnv } from "../../../../lib/runtimeEnv";
import { readPublishedSongBySlug } from "../../../songs/songData";

export const dynamic = "force-dynamic";

const positiveCacheControl = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const negativeCacheControl = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function dataUrlToResponse(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return null;

  return new Response(Buffer.from(match[2], "base64"), {
    headers: { "Cache-Control": positiveCacheControl, "Content-Type": match[1] }
  });
}

async function storageImageToResponse(imageUrl: string) {
  try {
    const supabaseUrl = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseUrl) return null;

    const source = new URL(imageUrl);
    if (
      source.protocol !== "https:" ||
      source.origin !== new URL(supabaseUrl).origin ||
      !source.pathname.startsWith("/storage/v1/object/public/")
    ) return null;

    const response = await fetch(source, { cache: "no-store" });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.startsWith("image/")) return null;

    return new Response(response.body, {
      headers: { "Cache-Control": positiveCacheControl, "Content-Type": contentType }
    });
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug || slug.length > 100 || !slugPattern.test(slug)) {
    return new Response("Invalid slug", { status: 400, headers: { "Cache-Control": negativeCacheControl } });
  }

  const song = await readPublishedSongBySlug(slug);
  if (!song) return new Response("Not Found", { status: 404, headers: { "Cache-Control": negativeCacheControl } });

  const embeddedImage = dataUrlToResponse(song.coverUrl);
  if (embeddedImage) return embeddedImage;

  const storageImage = await storageImageToResponse(song.coverUrl);
  if (storageImage) return storageImage;

  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#f8f3ed", display: "flex", height: "100%", justifyContent: "center", padding: 56, width: "100%" }}>
      <div style={{ background: "white", border: "1px solid #eadfd4", borderRadius: 28, display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", padding: 56, width: "100%" }}>
        <div style={{ color: "#ad4f4f", fontSize: 34, fontWeight: 800 }}>JapanNote</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ color: "#111827", fontSize: 72, fontWeight: 900, lineHeight: 1.15 }}>{song.title.slice(0, 44)}</div>
          <div style={{ color: "#4b5563", fontSize: 34, lineHeight: 1.45 }}>{(song.description || "日文歌曲學習").slice(0, 88)}</div>
        </div>
        <div style={{ color: "#8b6f5a", fontSize: 26 }}>japan-note.com</div>
      </div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": positiveCacheControl } }
  );
}
