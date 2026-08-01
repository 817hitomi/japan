"use client";

import { readApiError } from "../../lib/apiErrors";
import { normalizeSong, SongListItem, SongRecord } from "./songTypes";

export async function fetchSongs(): Promise<SongListItem[]> {
  const response = await fetch("/api/songs", { cache: "no-store" });
  if (!response.ok) throw new Error(await readApiError(response, `Songs API failed: ${response.status}`));
  return ((await response.json()) as { songs?: SongListItem[] }).songs ?? [];
}

export async function fetchSong(id: number): Promise<SongRecord> {
  const response = await fetch(`/api/songs/${id}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await readApiError(response, `Song API failed: ${response.status}`));
  const song = ((await response.json()) as { song?: SongRecord }).song;
  if (!song) throw new Error("歌曲資料不存在。");
  return normalizeSong(song);
}

export async function saveSong(song: SongRecord, mode: "create" | "update") {
  const response = await fetch(mode === "create" ? "/api/songs" : `/api/songs/${song.id}`, {
    method: mode === "create" ? "POST" : "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalizeSong(song))
  });
  if (!response.ok) throw new Error(await readApiError(response, `Save song failed: ${response.status}`));
  const saved = ((await response.json()) as { song?: SongRecord }).song;
  if (!saved) throw new Error("儲存後沒有收到歌曲資料。");
  return normalizeSong(saved);
}

export async function deleteSongs(ids: number[]) {
  const response = await fetch("/api/songs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
  if (!response.ok) throw new Error(await readApiError(response, `Delete songs failed: ${response.status}`));
}
