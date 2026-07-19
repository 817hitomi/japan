import { createRequestTimer } from "../lib/requestDiagnostics";

export default function NotFound() {
  const timer = createRequestTimer("404 handling", { route: "not-found" });
  timer.end({ status: 404 });

  return (
    <main>
      <h1>404</h1>
      <p>Not found</p>
    </main>
  );
}
