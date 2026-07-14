import { AdminShell } from "../notes/AdminNotesClient";
import styles from "../notes/AdminNotes.module.scss";

export default function AdminQuizzesPage() {
  return (
    <AdminShell>
      <p className={styles.statusMessage}>模擬測驗尚未建立。</p>
    </AdminShell>
  );
}
