import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { PublicNoteRecord } from "../../../notes/noteTypes";
import { noteToPayload, rowToNote } from "../noteMapper";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load note" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const note = (await request.json()) as PublicNoteRecord;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("learning_notes")
      .update(noteToPayload({ ...note, id: Number(id) }))
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ note: rowToNote(data) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update note" }, { status: 500 });
  }
}
