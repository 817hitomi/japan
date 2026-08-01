import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminRoute } from "../../../lib/adminRouteAuth";
import { getApiErrorMessage } from "../../../lib/apiErrors";
import { createSupabaseAdminClient, createSupabaseReadClient } from "../../../lib/supabase/server";
import { SongRecord } from "../../songs/songTypes";
import { rowToSong, songListSelect, songToPayload } from "./songMapper";

export const dynamic = "force-dynamic";
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(request: NextRequest) {
  try {
    const publishedOnly = request.nextUrl.searchParams.get("status") === "published";
    if (!publishedOnly) {
      const authError = await requireAdminRoute();
      if (authError) return authError;
    }
    const supabase = publishedOnly ? createSupabaseReadClient() : createSupabaseAdminClient();
    let query = supabase.from("songs").select(songListSelect).order("published_date", { ascending: false }).order("id", { ascending: false });
    if (publishedOnly) query = query.eq("status", "published");
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ songs: (data ?? []).map((row) => rowToSong(row)) });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to load songs") }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminRoute();
  if (authError) return authError;
  try {
    const song = (await request.json()) as SongRecord;
    if (!slugPattern.test(song.slug?.trim() ?? "")) return NextResponse.json({ error: "網址代稱只能使用小寫英文、數字與連字號。" }, { status: 400 });
    const supabase = createSupabaseAdminClient();
    const { data: duplicate, error: duplicateError } = await supabase.from("songs").select("id").eq("slug", song.slug.trim()).maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) return NextResponse.json({ error: "網址代稱已存在。" }, { status: 409 });
    const { data, error } = await supabase.from("songs").insert(songToPayload(song)).select("*").single();
    if (error) throw error;
    const savedSong = rowToSong(data);
    revalidatePath(`/songs/${savedSong.slug}`);
    revalidatePath("/songs/[slug]", "page");
    revalidatePath("/songs/chiisana-yume");
    return NextResponse.json({ song: savedSong }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to create song") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdminRoute();
  if (authError) return authError;
  try {
    const body = (await request.json()) as { ids?: number[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => Number.isSafeInteger(id) && id > 0) : [];
    if (ids.length === 0) return NextResponse.json({ error: "請選擇要刪除的歌曲。" }, { status: 400 });
    const { error } = await createSupabaseAdminClient().from("songs").delete().in("id", ids);
    if (error) throw error;
    revalidatePath("/songs/[slug]", "page");
    revalidatePath("/songs/chiisana-yume");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to delete songs") }, { status: 500 });
  }
}
