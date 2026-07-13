"use client";

import { normalizeNote, PublicNoteRecord, seedNotes } from "./noteTypes";

export type { NoteBlockType, NoteContentBlock, PublicNoteRecord } from "./noteTypes";
export { normalizeNote, seedNotes } from "./noteTypes";

export const noteStorageKey = "japannote-admin-notes";
const noteImportCompletedKey = "japannote-admin-notes-imported";

export function readStoredNotes() {
  if (typeof window === "undefined") {
    return seedNotes;
  }

  const raw = window.localStorage.getItem(noteStorageKey);
  if (!raw) {
    window.localStorage.setItem(noteStorageKey, JSON.stringify(seedNotes));
    return seedNotes;
  }

  try {
    const parsed = JSON.parse(raw) as PublicNoteRecord[];
    return Array.isArray(parsed) ? parsed.map(normalizeNote) : seedNotes;
  } catch {
    return seedNotes;
  }
}

export function writeStoredNotes(notes: PublicNoteRecord[]) {
  window.localStorage.setItem(noteStorageKey, JSON.stringify(notes));
}

async function parseNotesResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`Notes API failed: ${response.status}`);
  }

  const payload = (await response.json()) as { notes?: PublicNoteRecord[] };
  return Array.isArray(payload.notes) ? payload.notes.map(normalizeNote) : seedNotes;
}

export async function fetchNotes(status: "published" | "all" = "all") {
  const response = await fetch(`/api/notes?status=${status}`, { cache: "no-store" });
  return parseNotesResponse(response);
}

export async function readNotesWithFallback(status: "published" | "all" = "all") {
  try {
    const remoteNotes = await fetchNotes(status);
    const localNotes = readStoredNotes();

    if (remoteNotes.length === 0 && localNotes.length > 0) {
      return status === "published" ? localNotes.filter((note) => note.status === "已發布") : localNotes;
    }

    return remoteNotes;
  } catch {
    const localNotes = readStoredNotes();
    return status === "published" ? localNotes.filter((note) => note.status === "已發布") : localNotes;
  }
}

export async function saveNote(note: PublicNoteRecord, mode: "create" | "update") {
  const response = await fetch(mode === "update" ? `/api/notes/${note.id}` : "/api/notes", {
    method: mode === "update" ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note)
  });

  if (!response.ok) {
    throw new Error(`Save note failed: ${response.status}`);
  }

  const payload = (await response.json()) as { note?: PublicNoteRecord };
  if (!payload.note) {
    throw new Error("Save note response missing note");
  }

  return normalizeNote(payload.note);
}

export async function uploadMediaFile(file: File, type: "image" | "video") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  const payload = (await response.json()) as { url?: string };
  if (!payload.url) {
    throw new Error("Upload response missing url");
  }

  return payload.url;
}

export async function importStoredNotesToDatabase() {
  const storedNotes = readStoredNotes().map(normalizeNote);
  const importedNotes: PublicNoteRecord[] = [];

  for (const note of storedNotes) {
    importedNotes.push(await saveNote(note, "create"));
  }

  return importedNotes;
}

export function hasImportedStoredNotes() {
  return typeof window !== "undefined" && window.localStorage.getItem(noteImportCompletedKey) === "true";
}

export function markStoredNotesImported() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(noteImportCompletedKey, "true");
  }
}

export async function deleteNotes(ids: number[]) {
  const response = await fetch("/api/notes", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  });

  if (!response.ok) {
    throw new Error(`Delete notes failed: ${response.status}`);
  }
}

export async function moveNotesCategory(fromCategory: string, toCategory: string) {
  const response = await fetch("/api/notes", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromCategory, toCategory })
  });

  if (!response.ok) {
    throw new Error(`Move notes category failed: ${response.status}`);
  }
}
