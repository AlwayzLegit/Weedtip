/**
 * Renders a JSON-LD structured-data block. Server-rendered into <head>/<body> so
 * crawlers (Google rich results) can read LocalBusiness/Product schema.
 * `<` is escaped because DB-sourced strings (scraped names, descriptions, FAQ
 * answers) flow in — an embedded `</script>` would otherwise terminate the tag
 * and inject markup. The unicode-escape form stays valid JSON for crawlers.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
