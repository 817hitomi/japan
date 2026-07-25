import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../../lib/apiErrors";
import { withArticleCacheInvalidation } from "../../../../lib/articleCacheInvalidation";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { requireAdminRoute } from "../../../../lib/adminRouteAuth";
import { PublicNoteRecord } from "../../../notes/noteTypes";
import { adminNoteListSelect, noteToPayload, rowToNote } from "../noteMapper";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const authError = await requireAdminRoute();
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("learning_notes")
      .select("*")
      .eq("id", Number(id))
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ note: rowToNote(data) });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to load note") }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const authError = await requireAdminRoute();
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isSafeInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
    }

    const note = (await request.json()) as PublicNoteRecord;
    const supabase = createSupabaseAdminClient();
    const { data: previousNote, error: readError } = await supabase
      .from("learning_notes")
      .select("id,slug")
      .eq("id", numericId)
      .maybeSingle();
    if (readError) throw readError;

    const { data, error } = await supabase
      .from("learning_notes")
      .update(noteToPayload({ ...note, id: numericId }))
      .eq("id", numericId)
      .select(adminNoteListSelect)
      .single();
    if (error) throw error;

    const updatedNote = rowToNote(data);
    return withArticleCacheInvalidation(
      NextResponse.json({ note: updatedNote }),
      [previousNote?.slug, previousNote?.id, updatedNote.slug, updatedNote.id]
    );
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to update note") }, { status: 500 });
  }
}
