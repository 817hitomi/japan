import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminRoute } from "../../../../lib/adminRouteAuth";
import { getApiErrorMessage } from "../../../../lib/apiErrors";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { SongRecord } from "../../../songs/songTypes";
import { rowToSong, songToPayload } from "../songMapper";

type RouteContext = { params: Promise<{ id: string }> };
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(_request: NextRequest, context: RouteContext) {
  const authError = await requireAdminRoute();
  if (authError) return authError;
  try {
    const id = Number((await context.params).id);
    const { data, error } = await createSupabaseAdminClient().from("songs").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "找不到歌曲。" }, { status: 404 });
    return NextResponse.json({ song: rowToSong(data) });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to load song") }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authError = await requireAdminRoute();
  if (authError) return authError;
  try {
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "歌曲編號無效。" }, { status: 400 });
    const song = (await request.json()) as SongRecord;
    if (!slugPattern.test(song.slug?.trim() ?? "")) return NextResponse.json({ error: "網址代稱只能使用小寫英文、數字與連字號。" }, { status: 400 });
    const supabase = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase.from("songs").select("slug").eq("id", id).maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return NextResponse.json({ error: "找不到歌曲。" }, { status: 404 });
    const { data: duplicate, error: duplicateError } = await supabase.from("songs").select("id").eq("slug", song.slug.trim()).neq("id", id).maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) return NextResponse.json({ error: "網址代稱已存在。" }, { status: 409 });
    const { data, error } = await supabase.from("songs").update(songToPayload({ ...song, id })).eq("id", id).select("*").single();
    if (error) throw error;
    const savedSong = rowToSong(data);
    revalidatePath(`/songs/${existing.slug}`);
    if (savedSong.slug !== existing.slug) revalidatePath(`/songs/${savedSong.slug}`);
    revalidatePath("/songs/[slug]", "page");
    revalidatePath("/songs/chiisana-yume");
    return NextResponse.json({ song: savedSong });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to update song") }, { status: 500 });
  }
}
