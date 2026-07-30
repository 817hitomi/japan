"use client";

import { normalizeNote, PublicNoteRecord, seedNotes } from "./noteTypes";
import { readApiError } from "../../lib/apiErrors";
import { readLocalStorage, writeLocalStorage } from "../../lib/browserStorage";

export type { NoteBlockType, NoteContentBlock, PublicNoteRecord } from "./noteTypes";
export { getNotePath, getNotePreviewImage, getNoteRouteKey, normalizeNote, seedNotes } from "./noteTypes";

export const noteStorageKey = "japannote-admin-notes";
const noteImportCompletedKey = "japannote-admin-notes-imported";

export type NotesReadResult = {
  source: "database" | "local";
  notes: PublicNoteRecord[];
  page: number;
  pageSize: number;
  total: number;
  categories: string[];
  error?: string;
};

export type NotesReadOptions = {
  page?: number;
  pageSize?: number;
  category?: string;
  includeCategories?: boolean;
};

export type NoteReadResult = {
  source: "database" | "local";
  note: PublicNoteRecord | null;
  error?: string;
};

export function readStoredNotes() {
  if (typeof window === "undefined") {
    return seedNotes;
  }

  const raw = readLocalStorage(noteStorageKey);
  if (!raw) {
    writeLocalStorage(noteStorageKey, JSON.stringify(seedNotes));
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
  writeLocalStorage(noteStorageKey, JSON.stringify(Array.isArray(notes) ? notes : []));
}

async function parseNotesResponse(response: Response, options: NotesReadOptions = {}) {
  if (!response.ok) {
    throw new Error(await readApiError(response, `Notes API failed: ${response.status}`));
  }

  const payload = (await response.json()) as {
    notes?: PublicNoteRecord[];
    page?: number;
    pageSize?: number;
    total?: number;
    categories?: string[];
  };
  const notes = Array.isArray(payload.notes) ? payload.notes.map(normalizeNote) : [];
  return {
    notes,
    page: payload.page ?? options.page ?? 1,
    pageSize: payload.pageSize ?? options.pageSize ?? Math.max(notes.length, 1),
    total: payload.total ?? notes.length,
    categories: Array.isArray(payload.categories) ? payload.categories.filter(Boolean) : []
  };
}

export async function fetchNotes(status: "published" | "all" = "all", options: NotesReadOptions = {}) {
  const params = new URLSearchParams({ status });
  if (options.page) params.set("page", String(options.page));
  if (options.pageSize) params.set("pageSize", String(options.pageSize));
  if (options.category) params.set("category", options.category);
  if (options.includeCategories) params.set("includeCategories", "true");
  const response = await fetch(`/api/notes?${params.toString()}`, { cache: "no-store" });
  return parseNotesResponse(response, options);
}

export async function fetchNote(id: number) {
  const response = await fetch(`/api/notes/${id}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Note API failed: ${response.status}`));
  }

  const payload = (await response.json()) as { note?: PublicNoteRecord };
  return payload.note ? normalizeNote(payload.note) : null;
}

export async function readNoteWithSource(id: number): Promise<NoteReadResult> {
  try {
    return { source: "database", note: await fetchNote(id) };
  } catch (error) {
    return {
      source: "local",
      note: readStoredNotes().find((note) => note.id === id) ?? null,
      error: error instanceof Error ? error.message : "Note API failed"
    };
  }
}

export async function readNotesWithFallback(status: "published" | "all" = "all", options: NotesReadOptions = {}) {
  const result = await readNotesWithSource(status, options);
  return result.notes;
}

export async function readNotesWithSource(
  status: "published" | "all" = "all",
  options: NotesReadOptions = {}
): Promise<NotesReadResult> {
  function readLocalResult(error?: string): NotesReadResult {
    const allLocalNotes = readStoredNotes();
    const statusNotes = status === "published" ? allLocalNotes.filter((note) => note.status === "已發布") : allLocalNotes;
    const categoryNotes = options.category ? statusNotes.filter((note) => note.category === options.category) : statusNotes;
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? Math.max(categoryNotes.length, 1);
    const from = (page - 1) * pageSize;
    return {
      source: "local",
      notes: categoryNotes.slice(from, from + pageSize),
      page,
      pageSize,
      total: categoryNotes.length,
      categories: Array.from(new Set(allLocalNotes.map((note) => note.category).filter(Boolean))),
      error
    };
  }

  try {
    const remoteResult = await fetchNotes(status, options);
    const localNotes = readStoredNotes();

    if (remoteResult.total === 0 && localNotes.length > 0) {
      return readLocalResult("資料庫沒有文章，暫時顯示本機資料。");
    }

    return { source: "database", ...remoteResult };
  } catch (error) {
    return readLocalResult(error instanceof Error ? error.message : "Notes API failed");
  }
}

export async function saveNote(note: PublicNoteRecord, mode: "create" | "update") {
  const response = await fetch(mode === "update" ? `/api/notes/${note.id}` : "/api/notes", {
    method: mode === "update" ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Save note failed: ${response.status}`));
  }

  const payload = (await response.json()) as { note?: PublicNoteRecord };
  if (!payload.note) {
    throw new Error("Save note response missing note");
  }

  return normalizeNote(payload.note);
}

export async function uploadMediaFile(file: File, type: "image" | "video" | "audio") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const response = await fetch("/api/uploads", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Upload failed: ${response.status}`));
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
  return readLocalStorage(noteImportCompletedKey) === "true";
}

export function markStoredNotesImported() {
  writeLocalStorage(noteImportCompletedKey, "true");
}

export async function deleteNotes(ids: number[]) {
  const response = await fetch("/api/notes", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Delete notes failed: ${response.status}`));
  }
}

export async function moveNotesCategory(fromCategory: string, toCategory: string) {
  const response = await fetch("/api/notes", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromCategory, toCategory })
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Move notes category failed: ${response.status}`));
  }
}
