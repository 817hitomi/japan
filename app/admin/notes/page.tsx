import AdminNotesClient from "./AdminNotesClient";

type AdminNotesPageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

function normalizePage(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function AdminNotesPage({ searchParams }: AdminNotesPageProps) {
  const { page } = (await searchParams) ?? {};
  return <AdminNotesClient initialMode="list" initialPage={normalizePage(page)} />;
}
