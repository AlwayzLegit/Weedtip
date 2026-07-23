import type { Metadata } from 'next';
import { AlertTriangle, Check, ExternalLink, Link2Off, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'SEO · Admin' };

// Coverage reflects the last GSC inspection sweep; read fresh each request.
export const dynamic = 'force-dynamic';

type CoverageRow = { coverage_state: string; n: number };
type ProblemRow = {
  url: string;
  coverage_state: string | null;
  referring_urls: number | null;
  last_crawl_time: string | null;
  google_canonical: string | null;
  user_canonical: string | null;
};

/** Google reports "...indexed" for indexed pages and "...not indexed" for the rest. */
function isIndexed(state: string): boolean {
  const s = state.toLowerCase();
  return s.includes('indexed') && !s.includes('not indexed');
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="card sheen p-5">
      <p className={`text-2xl font-bold tracking-tight ${accent ? 'text-primary' : ''}`}>{value}</p>
      <p className="text-muted mt-0.5 text-sm">{label}</p>
      {sub && <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>}
    </div>
  );
}

export default async function AdminSeo() {
  const supabase = await createClient();

  const [{ data: coverage }, { data: problems }] = await Promise.all([
    supabase.rpc('seo_coverage_summary'),
    supabase
      .from('page_index_status')
      .select(
        'url, coverage_state, referring_urls, last_crawl_time, google_canonical, user_canonical',
      )
      .or('verdict.is.null,verdict.neq.PASS')
      .order('checked_at', { ascending: false })
      .limit(100),
  ]);

  const rows = (coverage ?? []) as CoverageRow[];
  const total = rows.reduce((s, r) => s + Number(r.n), 0);
  const indexed = rows
    .filter((r) => isIndexed(r.coverage_state))
    .reduce((s, r) => s + Number(r.n), 0);
  const notIndexed = total - indexed;
  const pct = total > 0 ? Math.round((indexed / total) * 100) : 0;
  const maxN = Math.max(1, ...rows.map((r) => Number(r.n)));

  const problemRows = (problems ?? []) as ProblemRow[];
  const canonicalMismatch = problemRows.filter(
    (r) => r.user_canonical && r.google_canonical && r.user_canonical !== r.google_canonical,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">System</p>
        <h2 className="text-2xl font-bold">SEO — index coverage</h2>
        <p className="text-muted mt-1 text-sm">
          How Google actually indexes our pages, from the nightly Search Console URL Inspection
          sweep. Google can&apos;t be forced to index — this shows <strong>which</strong> pages it
          skips and
          <strong> why</strong>, so we can target them.
        </p>
      </div>

      {total === 0 ? (
        <div className="rounded-card border-border bg-surface space-y-3 border p-6 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <Search className="text-muted h-5 w-5" /> No coverage data yet
          </div>
          <p className="text-muted">
            The Google Search Console monitor hasn&apos;t recorded anything yet. To populate it:
          </p>
          <ol className="text-muted list-decimal space-y-1 pl-5">
            <li>
              Add the <code className="font-mono text-xs">GSC_SERVICE_ACCOUNT_JSON</code> repo
              secret and grant the service account access to the Search Console property.
            </li>
            <li>
              Run <strong>Actions → GSC coverage inspect</strong> (nightly after that). It inspects
              up to 2,000 URLs/day and cycles the whole site over several nights.
            </li>
          </ol>
          <p className="text-muted-foreground text-xs">
            Full setup steps: <code className="font-mono">apps/web/scripts/SEO-INDEXING.md</code>.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="URLs inspected" value={total.toLocaleString()} />
            <Stat label="Indexed" value={indexed.toLocaleString()} accent />
            <Stat
              label="Not indexed"
              value={notIndexed.toLocaleString()}
              sub="crawl-budget / thin content"
            />
            <Stat label="Indexed share" value={`${pct}%`} />
          </div>

          <section className="space-y-3">
            <h3 className="text-muted text-sm font-semibold uppercase tracking-wide">
              Coverage states
            </h3>
            <div className="card space-y-3 p-4">
              {rows.map((r) => {
                const ok = isIndexed(r.coverage_state);
                return (
                  <div key={r.coverage_state}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">
                        {ok ? (
                          <Check className="text-primary h-4 w-4 shrink-0" />
                        ) : (
                          <X className="text-warning h-4 w-4 shrink-0" />
                        )}
                        <span className="font-medium">{r.coverage_state}</span>
                      </span>
                      <span className="text-muted">{Number(r.n).toLocaleString()}</span>
                    </div>
                    <div className="bg-surface-2 h-2 overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full ${ok ? 'bg-primary' : 'bg-warning'}`}
                        style={{ width: `${Math.max(3, (Number(r.n) / maxN) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {canonicalMismatch > 0 && (
            <div className="rounded-card border-warning/40 bg-warning/10 text-foreground flex items-start gap-2 border p-3 text-sm">
              <Link2Off className="text-warning mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{canonicalMismatch}</strong> of the sampled non-indexed pages have a
                Google-chosen canonical that differs from ours — Google is folding them into another
                URL.
              </span>
            </div>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-muted text-sm font-semibold uppercase tracking-wide">
                Not-indexed pages
              </h3>
              <Badge tone="muted">sample of {problemRows.length}</Badge>
            </div>
            {problemRows.length === 0 ? (
              <p className="text-muted card p-4 text-sm">
                Nothing flagged in the latest sweep — every inspected page is indexed. 🎉
              </p>
            ) : (
              <div className="card divide-border divide-y overflow-hidden">
                {problemRows.map((r) => {
                  const path = r.url.replace(/^https?:\/\/[^/]+/, '') || '/';
                  return (
                    <div key={r.url} className="flex items-start justify-between gap-4 p-3 text-sm">
                      <div className="min-w-0">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary inline-flex items-center gap-1 font-medium"
                        >
                          <span className="truncate">{path}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                        </a>
                        <p className="text-muted mt-0.5 text-xs">
                          {r.coverage_state ?? 'Unknown'}
                          {r.referring_urls != null && ` · ${r.referring_urls} referring URLs`}
                          {r.last_crawl_time &&
                            ` · crawled ${new Date(r.last_crawl_time).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            &quot;Crawled - currently not indexed&quot; is a thin-content signal (fix: menus, unique
            copy, internal links); &quot;Discovered - currently not indexed&quot; is crawl budget
            (fix: sitemap + internal links). The IndexNow job covers Bing/Yandex separately.
          </p>
        </>
      )}
    </div>
  );
}
