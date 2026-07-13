import AdminNotesClient from "../AdminNotesClient";

export default async function EditAdminNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <AdminNotesClient initialMode="edit" noteId={Number(id)} />;
}
