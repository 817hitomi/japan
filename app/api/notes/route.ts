import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../lib/apiErrors";
import { createSupabaseAdminClient, createSupabaseReadClient } from "../../../lib/supabase/server";
import { PublicNoteRecord } from "../../notes/noteTypes";
import { noteToPayload, rowToNote } from "./noteMapper";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const supabase = status === "published" ? createSupabaseReadClient() : createSupabaseAdminClient();
    let query = supabase
      .from("learning_notes")
      .select("*")
      .order("published_date", { ascending: false })
      .order("id", { ascending: false });

    if (status === "published") {
      query = query.eq("status", "已發布");
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ notes: (data ?? []).map(rowToNote) });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to load notes") }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const note = (await request.json()) as PublicNoteRecord;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("learning_notes")
      .insert(noteToPayload(note))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ note: rowToNote(data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to create note") }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { fromCategory?: string; toCategory?: string };

    if (!body.fromCategory || !body.toCategory) {
      return NextResponse.json({ error: "Missing category payload" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("learning_notes")
      .update({ category: body.toCategory })
      .eq("category", body.fromCategory);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to update notes") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { ids?: number[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter(Number.isFinite) : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Missing note ids" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("learning_notes").delete().in("id", ids);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to delete notes") }, { status: 500 });
  }
}
