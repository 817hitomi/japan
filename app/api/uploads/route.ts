import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/server";

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
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const type = formData.get("type") === "video" ? "video" : "image";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing upload file" }, { status: 400 });
    }

    if (type === "video" && !file.type.startsWith("video/")) {
      return NextResponse.json({ error: "Only video files are allowed" }, { status: 400 });
    }

    if (type === "image" && !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const extension = getSafeName(file.name).split(".").pop() || (type === "video" ? "mp4" : "jpg");
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload file" }, { status: 500 });
  }
}
