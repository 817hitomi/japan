import { createRequestTimer } from "../../lib/requestDiagnostics";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const timer = createRequestTimer("admin layout", { route: "/admin" });
  timer.end();
  return children;
}
