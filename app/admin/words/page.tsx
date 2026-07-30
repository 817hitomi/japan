import AdminWordsClient from "./AdminWordsClient";
import { normalizeKanaRowKey } from "../../words/kanaRows";

type AdminWordsPageProps = {
  searchParams?: Promise<{
    q?: string;
    kana?: string;
  }>;
};

export default async function AdminWordsPage({ searchParams }: AdminWordsPageProps) {
  const { q, kana } = (await searchParams) ?? {};
  return <AdminWordsClient initialPage={1} initialSearchText={q ?? ""} initialKanaRow={normalizeKanaRowKey(kana)} />;
}
