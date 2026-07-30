import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../lib/apiErrors";
import { withArticleCacheInvalidation } from "../../../lib/articleCacheInvalidation";
import { createSupabaseAdminClient, createSupabaseReadClient } from "../../../lib/supabase/server";
import { requireAdminRoute } from "../../../lib/adminRouteAuth";
import { preparePublicNoteCards, PublicNoteRecord } from "../../notes/noteTypes";
import { adminNoteListSelect, noteToPayload, rowToNote } from "./noteMapper";

export const dynamic = "force-dynamic";
const publicNotesLimit = 120;
const defaultAdminPageSize = 10;
const maxAdminPageSize = 50;
const publicNoteSummarySelect = "id,category,title,status,published_date,slug,tags,summary";
const duplicateSlugMessage = "網址代稱已被其他文章使用，請改用不重複的網址代稱。";

function readPositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    if (status !== "published") {
      const authError = await requireAdminRoute();
      if (authError) return authError;
    }
    const supabase = status === "published" ? createSupabaseReadClient() : createSupabaseAdminClient();
    const selectColumns = status === "published" ? publicNoteSummarySelect : adminNoteListSelect;
    const page = readPositiveInteger(request.nextUrl.searchParams.get("page"), 1);
    const pageSize = Math.min(readPositiveInteger(request.nextUrl.searchParams.get("pageSize"), defaultAdminPageSize), maxAdminPageSize);
    const category = request.nextUrl.searchParams.get("category")?.trim() ?? "";
    const includeCategories = request.nextUrl.searchParams.get("includeCategories") === "true";
    let query = supabase
      .from("learning_notes")
      .select(selectColumns, status === "published" ? undefined : { count: "exact" })
      .order("published_date", { ascending: false })
      .order("id", { ascending: false });

    if (status === "published") {
      query = query.eq("status", "已發布");
    }

    if (status === "published") {
      query = query.limit(publicNotesLimit);
    } else {
      if (category) {
        query = query.eq("category", category);
      }
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);
    }

    const categoriesQuery =
      status !== "published" && includeCategories
        ? supabase.from("learning_notes").select("category").order("category", { ascending: true })
        : null;
    const [{ data, error, count }, categoriesResult] = await Promise.all([query, categoriesQuery]);

    if (error) {
      throw error;
    }
    if (categoriesResult?.error) {
      throw categoriesResult.error;
    }

    const rows = (data ?? []) as unknown as Parameters<typeof rowToNote>[0][];
    const notes = rows.map(rowToNote);
    const categories = Array.from(
      new Set((categoriesResult?.data ?? []).map((row) => row.category).filter((item): item is string => Boolean(item)))
    );
    return NextResponse.json({
      notes: status === "published" ? preparePublicNoteCards(notes) : notes,
      ...(status === "published" ? {} : { page, pageSize, total: count ?? 0, categories })
    });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to load notes") }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminRoute();
  if (authError) return authError;

  try {
    const note = (await request.json()) as PublicNoteRecord;
    const supabase = createSupabaseAdminClient();
    const slug = note.slug?.trim();

    if (slug) {
      const { data: duplicateNote, error: duplicateError } = await supabase
        .from("learning_notes")
        .select("id")
        .eq("slug", slug)
        .limit(1)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicateNote) {
        return NextResponse.json({ error: duplicateSlugMessage }, { status: 409 });
      }
    }

    const { data, error } = await supabase
      .from("learning_notes")
      .insert(noteToPayload(note))
      .select(adminNoteListSelect)
      .single();

    if (error) {
      throw error;
    }

    const createdNote = rowToNote(data);
    return withArticleCacheInvalidation(
      NextResponse.json({ note: createdNote }, { status: 201 }),
      [createdNote.slug, createdNote.id]
    );
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to create note") }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdminRoute();
  if (authError) return authError;

  try {
    const body = (await request.json()) as { fromCategory?: string; toCategory?: string };

    if (!body.fromCategory || !body.toCategory) {
      return NextResponse.json({ error: "Missing category payload" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: affectedNotes, error: readError } = await supabase
      .from("learning_notes")
      .select("id,slug")
      .eq("category", body.fromCategory);
    if (readError) throw readError;

    const { error } = await supabase
      .from("learning_notes")
      .update({ category: body.toCategory })
      .eq("category", body.fromCategory);
    if (error) throw error;

    return withArticleCacheInvalidation(
      NextResponse.json({ ok: true }),
      (affectedNotes ?? []).flatMap((note) => [note.slug, note.id])
    );
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to update notes") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdminRoute();
  if (authError) return authError;

  try {
    const body = (await request.json()) as { ids?: number[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter(Number.isFinite) : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Missing note ids" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: deletedNotes, error: readError } = await supabase
      .from("learning_notes")
      .select("id,slug")
      .in("id", ids);
    if (readError) throw readError;

    const { error } = await supabase.from("learning_notes").delete().in("id", ids);
    if (error) throw error;

    return withArticleCacheInvalidation(
      NextResponse.json({ ok: true }),
      (deletedNotes ?? []).flatMap((note) => [note.slug, note.id])
    );
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to delete notes") }, { status: 500 });
  }
}
