import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../lib/apiErrors";
import { createSupabaseAdminClient } from "../../../lib/supabase/server";
import { requireAdminRoute } from "../../../lib/adminRouteAuth";

export const dynamic = "force-dynamic";

const bucketName = "note-media";

function getSafeName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminRoute();
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const rawType = formData.get("type");
    const type = rawType === "video" || rawType === "audio" ? rawType : "image";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing upload file" }, { status: 400 });
    }

    if (type === "video" && !file.type.startsWith("video/")) {
      return NextResponse.json({ error: "Only video files are allowed" }, { status: 400 });
    }

    if (type === "audio" && !file.type.startsWith("audio/")) {
      return NextResponse.json({ error: "Only audio files are allowed" }, { status: 400 });
    }

    if (type === "image" && !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const extension = getSafeName(file.name).split(".").pop() || (type === "video" ? "mp4" : type === "audio" ? "mp3" : "jpg");
    const path = `${type}s/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(bucketName).upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false
    });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to upload file") }, { status: 500 });
  }
}
