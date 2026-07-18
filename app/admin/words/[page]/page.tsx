import AdminWordsClient from "../AdminWordsClient";

type AdminWordsPagedRouteProps = {
  params: Promise<{
    page?: string;
  }>;
  searchParams?: Promise<{
    q?: string;
  }>;
};

function normalizePage(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AdminWordsPagedRoute({ params, searchParams }: AdminWordsPagedRouteProps) {
  const { page } = await params;
  const { q } = (await searchParams) ?? {};
  return <AdminWordsClient initialPage={normalizePage(page)} initialSearchText={q ?? ""} />;
}
