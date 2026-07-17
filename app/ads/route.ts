const ADS_TXT = "google.com, pub-9349912323064571, DIRECT, f08c47fec0942fa0\n";

export function GET() {
  return new Response(ADS_TXT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
