import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../lib/apiErrors";
import { createSupabaseAdminClient } from "../../../lib/supabase/server";
import { requireAdminRoute } from "../../../lib/adminRouteAuth";

export const dynamic = "force-dynamic";

const bucketName = "content-report-screenshots";
const maxScreenshotSize = 10 * 1024 * 1024;

type ContentReport = {
  id: number;
  message: string;
  pageUrl: string;
  screenshotUrl: string;
  userAgent: string;
  createdAt: string;
};

type ContentReportRow = {
  id: number;
  message: string;
  page_url: string | null;
  screenshot_path: string | null;
  user_agent: string | null;
  created_at: string;
};

type StoredContentReport = {
  id: number;
  message: string;
  pageUrl: string;
  screenshotPath: string | null;
  userAgent: string;
  createdAt: string;
};

type StorageReportFile = {
  path: string;
  report: StoredContentReport;
};

function isMissingTableError(error: unknown) {
  const message = getApiErrorMessage(error, "");
  return message.includes("public.content_reports") || message.includes("content_reports");
}

function getSafeExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^\w]+/g, "");

  if (extension) {
    return extension;
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  if (file.type === "image/gif") {
    return "gif";
  }

  return "jpg";
}

function getContentReportErrorMessage(error: unknown, fallback: string) {
  const message = getApiErrorMessage(error, fallback);

  if (message.includes("public.content_reports") || message.includes("content_reports")) {
    return "目前無法讀寫 content_reports，已啟用 Storage 備援仍失敗，請確認 Supabase Storage 權限。";
  }

  if (message.toLowerCase().includes("bucket not found") || message.includes(bucketName)) {
    return "截圖儲存空間建立失敗，請確認 Supabase Storage 權限。";
  }

  return message;
}

async function ensureReportBucket() {
  const supabase = createSupabaseAdminClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw listError;
  }

  const bucketOptions = {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "application/json"],
    fileSizeLimit: maxScreenshotSize,
    public: false
  };

  if (buckets.some((bucket) => bucket.id === bucketName)) {
    const { error } = await supabase.storage.updateBucket(bucketName, bucketOptions);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.storage.createBucket(bucketName, bucketOptions);

  if (error) {
    throw error;
  }
}

async function createSignedScreenshotUrl(path: string | null) {
  if (!path) {
    return "";
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.storage.from(bucketName).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? "";
}

async function rowToReport(row: ContentReportRow): Promise<ContentReport> {
  let screenshotUrl = "";

  if (row.screenshot_path) {
    screenshotUrl = await createSignedScreenshotUrl(row.screenshot_path);
  }

  return {
    id: row.id,
    message: row.message,
    pageUrl: row.page_url ?? "",
    screenshotUrl,
    userAgent: row.user_agent ?? "",
    createdAt: row.created_at
  };
}

async function storedReportToReport(report: StoredContentReport): Promise<ContentReport> {
  return {
    id: report.id,
    message: report.message,
    pageUrl: report.pageUrl,
    screenshotUrl: await createSignedScreenshotUrl(report.screenshotPath),
    userAgent: report.userAgent,
    createdAt: report.createdAt
  };
}

async function loadStorageReports() {
  const files = await loadStorageReportFiles();
  const reports = await Promise.all(files.map((file) => storedReportToReport(file.report)));

  return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function loadStorageReportFiles(): Promise<StorageReportFile[]> {
  await ensureReportBucket();

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucketName).list("messages", {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" }
  });

  if (error) {
    throw error;
  }

  return Promise.all(
    (data ?? [])
      .filter((item) => item.name.endsWith(".json"))
      .map(async (item) => {
        const path = `messages/${item.name}`;
        const { data: file, error: downloadError } = await supabase.storage.from(bucketName).download(path);

        if (downloadError) {
          throw downloadError;
        }

        return {
          path,
          report: JSON.parse(await file.text()) as StoredContentReport
        };
      })
  );
}

async function saveStorageReport(report: StoredContentReport) {
  await ensureReportBucket();

  const supabase = createSupabaseAdminClient();
  const jsonPath = `messages/${report.createdAt.replace(/[^\d]/g, "")}-${crypto.randomUUID()}.json`;
  const body = JSON.stringify(report, null, 2);
  const { error } = await supabase.storage.from(bucketName).upload(jsonPath, new Blob([body], { type: "application/json" }), {
    cacheControl: "0",
    contentType: "application/json",
    upsert: false
  });

  if (error) {
    throw error;
  }
}

export async function GET() {
  const authError = await requireAdminRoute();
  if (authError) return authError;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("content_reports")
      .select("id,message,page_url,screenshot_path,user_agent,created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      if (isMissingTableError(error)) {
        const reports = await loadStorageReports();
        return NextResponse.json({ reports, source: "storage" });
      }

      throw error;
    }

    const reports = await Promise.all(((data ?? []) as ContentReportRow[]).map(rowToReport));
    return NextResponse.json({ reports, source: "database" });
  } catch (error) {
    return NextResponse.json({ reports: [], error: getContentReportErrorMessage(error, "Unable to load reports") }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const message = String(formData.get("message") ?? "").trim();
    const pageUrl = String(formData.get("pageUrl") ?? "").trim();
    const userAgent = String(formData.get("userAgent") ?? "").trim();
    const screenshot = formData.get("screenshot");

    if (!message) {
      return NextResponse.json({ error: "請輸入回報內容。" }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: "回報內容請控制在 2000 字以內。" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const createdAt = new Date().toISOString();
    const reportId = Date.now();
    let screenshotPath: string | null = null;

    if (screenshot instanceof File && screenshot.size > 0) {
      if (!screenshot.type.startsWith("image/")) {
        return NextResponse.json({ error: "截圖只能上傳圖片檔。" }, { status: 400 });
      }

      if (screenshot.size > maxScreenshotSize) {
        return NextResponse.json({ error: "截圖檔案請小於 10 MB。" }, { status: 400 });
      }

      await ensureReportBucket();
      screenshotPath = `screenshots/${createdAt.slice(0, 10)}/${crypto.randomUUID()}.${getSafeExtension(screenshot)}`;
      const { error } = await supabase.storage.from(bucketName).upload(screenshotPath, screenshot, {
        cacheControl: "31536000",
        contentType: screenshot.type,
        upsert: false
      });

      if (error) {
        throw error;
      }
    }

    const fallbackReport: StoredContentReport = {
      id: reportId,
      message,
      pageUrl,
      screenshotPath,
      userAgent,
      createdAt
    };

    const { data, error } = await supabase
      .from("content_reports")
      .insert({
        message,
        page_url: pageUrl || null,
        screenshot_path: screenshotPath,
        user_agent: userAgent || null
      })
      .select("id")
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        await saveStorageReport(fallbackReport);
        return NextResponse.json({ reportId, source: "storage" });
      }

      throw error;
    }

    return NextResponse.json({ reportId: data.id, source: "database" });
  } catch (error) {
    return NextResponse.json({ error: getContentReportErrorMessage(error, "Unable to submit report") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdminRoute();
  if (authError) return authError;

  try {
    const body = (await request.json()) as { ids?: number[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => Number.isFinite(id)) : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "請先勾選要刪除的回報。" }, { status: 400 });
    }

    const selectedIds = new Set(ids);
    const supabase = createSupabaseAdminClient();
    let deletedDatabaseCount = 0;
    let deletedStorageCount = 0;

    const { data: databaseRows, error: selectError } = await supabase
      .from("content_reports")
      .select("id,screenshot_path")
      .in("id", ids);

    if (!selectError) {
      const screenshotPaths = ((databaseRows ?? []) as Pick<ContentReportRow, "id" | "screenshot_path">[])
        .map((row) => row.screenshot_path)
        .filter((path): path is string => Boolean(path));

      const { error: deleteError } = await supabase.from("content_reports").delete().in("id", ids);

      if (deleteError) {
        throw deleteError;
      }

      deletedDatabaseCount = databaseRows?.length ?? 0;

      if (screenshotPaths.length > 0) {
        const { error: removeError } = await supabase.storage.from(bucketName).remove(screenshotPaths);

        if (removeError) {
          throw removeError;
        }
      }
    } else if (!isMissingTableError(selectError)) {
      throw selectError;
    }

    const storageFiles = await loadStorageReportFiles();
    const pathsToRemove = storageFiles
      .filter((file) => selectedIds.has(file.report.id))
      .flatMap((file) => [file.path, file.report.screenshotPath].filter((path): path is string => Boolean(path)));

    if (pathsToRemove.length > 0) {
      const { error } = await supabase.storage.from(bucketName).remove(pathsToRemove);

      if (error) {
        throw error;
      }

      deletedStorageCount = storageFiles.filter((file) => selectedIds.has(file.report.id)).length;
    }

    return NextResponse.json({
      deleted: deletedDatabaseCount + deletedStorageCount,
      deletedDatabaseCount,
      deletedStorageCount
    });
  } catch (error) {
    return NextResponse.json({ error: getContentReportErrorMessage(error, "Unable to delete reports") }, { status: 500 });
  }
}
