import type { AffiliateListItem, AffiliateStatus } from "../app/affiliates/affiliateTypes";
import { createRequestTimer } from "./requestDiagnostics";
import { createSupabaseAdminClient } from "./supabase/server";

type AffiliateListRow = {
  id: number;
  category: string | null;
  title: string | null;
  status: string | null;
  published_date: string | null;
};

export const adminAffiliatePageSize = 25;

export type AdminAffiliateFilters = {
  page?: string;
  q?: string;
  category?: string;
  status?: string;
};

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function escapeIlike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function rowToListItem(row: AffiliateListRow): AffiliateListItem {
  return {
    id: Number(row.id),
    category: row.category?.trim() || "未分類",
    title: row.title?.trim() || "未命名內容",
    status: row.status === "published" ? "published" : "draft",
    date: row.published_date ?? ""
  };
}

export async function readAdminAffiliatePage(filters: AdminAffiliateFilters) {
  const page = parsePage(filters.page);
  const search = filters.q?.trim().slice(0, 100) ?? "";
  const category = filters.category?.trim().slice(0, 100) ?? "";
  const status: AffiliateStatus | "" =
    filters.status === "published" || filters.status === "draft" ? filters.status : "";
  const from = (page - 1) * adminAffiliatePageSize;
  const to = from + adminAffiliatePageSize - 1;
  const queryTimer = createRequestTimer("affiliates query", {
    page,
    pageSize: adminAffiliatePageSize,
    hasSearch: Boolean(search),
    hasCategory: Boolean(category),
    status: status || "all"
  });

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("affiliates")
    .select("id,category,title,status,published_date", { count: "exact" })
    .order("published_date", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (search) query = query.ilike("title", `%${escapeIlike(search)}%`);
  if (category) query = query.eq("category", category);
  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;
  if (error) {
    queryTimer.end({ rows: 0, errorCode: error.code });
    if (error.code === "PGRST205") {
      const transformTimer = createRequestTimer("data transform", {
        entity: "affiliates",
        inputRows: 0
      });
      transformTimer.end({ outputRows: 0, skipped: true });
      return {
        affiliates: [] as AffiliateListItem[],
        total: 0,
        page,
        pageSize: adminAffiliatePageSize,
        filters: { q: search, category, status }
      };
    }
    throw error;
  }

  const rows = (data ?? []) as AffiliateListRow[];
  queryTimer.end({ rows: rows.length, totalRows: count ?? 0 });

  const transformTimer = createRequestTimer("data transform", {
    entity: "affiliates",
    inputRows: rows.length
  });
  const affiliates = rows.map(rowToListItem);
  transformTimer.end({ outputRows: affiliates.length });

  return {
    affiliates,
    total: count ?? 0,
    page,
    pageSize: adminAffiliatePageSize,
    filters: { q: search, category, status }
  };
}
