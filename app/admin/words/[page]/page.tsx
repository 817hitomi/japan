import AdminWordsClient from "../AdminWordsClient";
import { normalizeKanaRowKey } from "../../../words/kanaRows";

type AdminWordsPagedRouteProps = {
  params: Promise<{
    page?: string;
  }>;
  searchParams?: Promise<{
    q?: string;
    kana?: string;
  }>;
};

function normalizePage(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AdminWordsPagedRoute({ params, searchParams }: AdminWordsPagedRouteProps) {
  const { page } = await params;
  const { q, kana } = (await searchParams) ?? {};
  return (
    <AdminWordsClient
      initialPage={normalizePage(page)}
      initialSearchText={q ?? ""}
      initialKanaRow={normalizeKanaRowKey(kana)}
    />
  );
}
