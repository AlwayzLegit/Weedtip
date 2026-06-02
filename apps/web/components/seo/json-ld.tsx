/**
 * Renders a JSON-LD structured-data block. Server-rendered into <head>/<body> so
 * crawlers (Google rich results) can read LocalBusiness/Product schema.
 * Data is our own, serialized server-side — not user-controlled HTML.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
