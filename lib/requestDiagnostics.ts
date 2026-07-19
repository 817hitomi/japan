type DiagnosticFields = Record<string, boolean | number | string | null | undefined>;

const diagnosticsEnabled =
  process.env.NODE_ENV !== "production" || process.env.REQUEST_DIAGNOSTICS === "1" || process.env.REQUEST_DIAGNOSTICS === "true";

function normalizeFields(fields: DiagnosticFields = {}) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

export function logRequestDiagnostic(stage: string, event: string, fields: DiagnosticFields = {}) {
  if (!diagnosticsEnabled) {
    return;
  }

  console.log(
    JSON.stringify({
      source: "japannote",
      stage,
      event,
      ...normalizeFields(fields)
    })
  );
}

export function createRequestTimer(stage: string, fields: DiagnosticFields = {}) {
  if (!diagnosticsEnabled) {
    return {
      end() {},
      mark() {}
    };
  }

  const startedAt = performance.now();
  logRequestDiagnostic(stage, "start", fields);

  return {
    end(extraFields: DiagnosticFields = {}) {
      logRequestDiagnostic(stage, "end", {
        ...fields,
        ...extraFields,
        elapsedMs: Math.round(performance.now() - startedAt)
      });
    },
    mark(event: string, extraFields: DiagnosticFields = {}) {
      logRequestDiagnostic(stage, event, {
        ...fields,
        ...extraFields,
        elapsedMs: Math.round(performance.now() - startedAt)
      });
    }
  };
}
