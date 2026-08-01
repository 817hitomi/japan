import { createSupabaseAdminClient, createSupabaseReadClient } from "../../lib/supabase/server";
import { rowToSong } from "../api/songs/songMapper";
import { seedSong, SongRecord, SongRelatedItem, toSongRelatedItem } from "./songTypes";

const publicSongListSelect = "id,title,slug,artist,tags,status,level,published_date";

export async function readPublishedSongList(): Promise<SongRelatedItem[]> {
  try {
    const { data, error } = await createSupabaseReadClient()
      .from("songs")
      .select(publicSongListSelect)
      .eq("status", "published")
      .order("published_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(20);
    if (error) throw error;
    return (data ?? []).map((row) => toSongRelatedItem(rowToSong(row)));
  } catch {
    // Keep the checked-in published song available until the songs migration is deployed.
    return [toSongRelatedItem(seedSong)];
  }
}

export async function readPublishedSongBySlug(slug: string): Promise<SongRecord | null> {
  try {
    const { data, error } = await createSupabaseReadClient().from("songs").select("*").eq("status", "published").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (data) return rowToSong(data);
  } catch {
    // The checked-in song remains available until the songs migration is deployed.
  }
  return slug === seedSong.slug ? seedSong : null;
}

export async function readAdminSongById(id: number): Promise<SongRecord | null> {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const { data, error } = await createSupabaseAdminClient().from("songs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToSong(data) : null;
}
