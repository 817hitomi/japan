import AdminWordsClient from "./AdminWordsClient";

type AdminWordsPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function AdminWordsPage({ searchParams }: AdminWordsPageProps) {
  const { q } = (await searchParams) ?? {};
  return <AdminWordsClient initialPage={1} initialSearchText={q ?? ""} />;
}
