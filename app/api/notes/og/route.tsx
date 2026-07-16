import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { findNoteByRouteKey, getNotePreviewImage } from "../../../notes/noteTypes";
import { readPublishedNotesForPublicPage } from "../../../publicData";

export const dynamic = "force-dynamic";

const imageSize = {
  width: 1200,
  height: 630
};

function clampText(text: string, maxLength: number) {
  const value = text.trim();
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function dataUrlToResponse(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  return new Response(Buffer.from(match[2], "base64"), {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Content-Type": match[1]
    }
  });
}

function sanitizeImageText(text: string) {
  return text
    .replace(/[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f〜～]/g, "")
    .replace(/[「」『』【】]/g, "")
    .replace(/[｜|]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: NextRequest) {
  const routeKey = request.nextUrl.searchParams.get("slug") ?? "";
  const notes = await readPublishedNotesForPublicPage();
  const note = findNoteByRouteKey(notes, routeKey);
  const imageUrl = note ? getNotePreviewImage(note, "/brand/logo_b.png") : "/brand/logo_b.png";

  if (imageUrl.startsWith("data:")) {
    return dataUrlToResponse(imageUrl) ?? Response.redirect(new URL("/brand/logo_b.png", request.nextUrl.origin), 302);
  }

  return Response.redirect(new URL(imageUrl || "/brand/logo_b.png", request.nextUrl.origin), 302);
  const title = clampText(sanitizeImageText(note?.title || "") || "日文學習筆記", 44);
  const summary = clampText(sanitizeImageText(note?.summary || "") || "自學日文筆記", 88);
  const category = note?.category || "JapanNote";

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#f8f3ed",
          color: "#1f2933",
          display: "flex",
          fontFamily: "sans-serif",
          height: "100%",
          justifyContent: "center",
          padding: 56,
          width: "100%"
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #eadfd4",
            borderRadius: 28,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            justifyContent: "space-between",
            padding: 56,
            width: "100%"
          }}
        >
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <div style={{ color: "#ad4f4f", fontSize: 34, fontWeight: 800 }}>JapanNote</div>
            <div
              style={{
                background: "#f0e5d8",
                borderRadius: 999,
                color: "#7a4b35",
                fontSize: 26,
                fontWeight: 700,
                padding: "14px 24px"
              }}
            >
              {category}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div style={{ color: "#111827", fontSize: 72, fontWeight: 900, letterSpacing: 0, lineHeight: 1.15 }}>{title}</div>
            <div style={{ color: "#4b5563", fontSize: 34, lineHeight: 1.45 }}>{summary}</div>
          </div>

          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <div style={{ color: "#8b6f5a", fontSize: 26 }}>japan-note.com</div>
            <div
              style={{
                alignItems: "center",
                background: "#b54f4f",
                borderRadius: 80,
                color: "#ffffff",
                display: "flex",
                fontSize: 54,
                fontWeight: 900,
                height: 128,
                justifyContent: "center",
                width: 128
              }}
            >
              日
            </div>
          </div>
        </div>
      </div>
    ),
    imageSize
  );
}
