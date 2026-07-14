import { NextResponse } from "next/server";
import { getRuntimeEnv } from "../../../../../lib/runtimeEnv";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type NoteImageRow = {
  blocks: unknown;
  cover_url: string | null;
};

function getBlockImageUrl(blocks: unknown) {
  if (!Array.isArray(blocks)) {
    return "";
  }

  const imageBlock = blocks.find((block) => {
    if (!block || typeof block !== "object") {
      return false;
    }

    const candidate = block as { imageUrl?: unknown; type?: unknown };
    return candidate.type === "image" && typeof candidate.imageUrl === "string" && candidate.imageUrl.length > 0;
  }) as { imageUrl?: string } | undefined;

  return imageBlock?.imageUrl ?? "";
}

function dataUriToResponse(dataUri: string) {
  const match = dataUri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  const [, contentType, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Response(bytes, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": contentType
    }
  });
}

async function readNoteImage(id: string): Promise<string> {
  const numericId = Number(id);
  const supabaseUrl = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!Number.isFinite(numericId) || !supabaseUrl || !anonKey) {
    return "";
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/learning_notes?id=eq.${encodeURIComponent(String(numericId))}&select=cover_url,blocks&limit=1`,
    {
      cache: "no-store",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`
      }
    }
  );

  if (!response.ok) {
    return "";
  }

  const rows = (await response.json()) as NoteImageRow[];
  const note = rows[0];

  return note?.cover_url || getBlockImageUrl(note?.blocks);
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const imageUrl = await readNoteImage(id);

  if (!imageUrl) {
    return NextResponse.json({ error: "Note image not found" }, { status: 404 });
  }

  if (imageUrl.startsWith("data:image/")) {
    return dataUriToResponse(imageUrl) ?? NextResponse.json({ error: "Invalid note image" }, { status: 422 });
  }

  return NextResponse.redirect(imageUrl);
}
