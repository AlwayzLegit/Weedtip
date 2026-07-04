/**
 * Fetch every row of a Supabase query, paging past PostgREST's default row cap
 * (1,000 — see supabase/config.toml `max_rows`). Nationwide, a single state can
 * exceed the cap (CA ≈ 1,538, CO ≈ 1,093), so any full-table/full-state read
 * MUST page or it silently truncates.
 *
 *   const rows = await fetchAll<Row>((from, to) =>
 *     supabase.from('dispensaries').select('...').eq('state', code).range(from, to),
 *   );
 */
export async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data } = await query(from, from + pageSize - 1);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}
