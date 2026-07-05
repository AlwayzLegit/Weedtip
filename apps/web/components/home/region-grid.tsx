import Link from 'next/link';
import { citySlug, US_STATES } from '@/lib/seo';

export interface RegionEntry {
  state: string;
  dispensaryCount: number;
  topCities: { city: string; count: number }[];
}

/**
 * Weedmaps-style region directory: every live market with its biggest cities,
 * linking into the state/city landing pages. Pure links — this is the
 * homepage's internal-linking (SEO) workhorse.
 */
export function RegionGrid({ regions }: { regions: RegionEntry[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {regions.map((r) => {
        const name = US_STATES[r.state] ?? r.state;
        const st = r.state.toLowerCase();
        return (
          <div key={r.state} className="card p-5">
            <Link
              href={`/dispensaries/${st}`}
              className="hover:text-primary flex items-baseline justify-between gap-2 font-semibold transition-colors"
            >
              {name}
              <span className="text-muted text-xs font-normal">
                {r.dispensaryCount.toLocaleString()} shops
              </span>
            </Link>
            <ul className="mt-3 space-y-1.5">
              {r.topCities.map((c) => (
                <li key={c.city}>
                  <Link
                    href={`/dispensaries/${st}/${citySlug(c.city)}`}
                    className="text-muted hover:text-primary text-sm transition-colors"
                  >
                    {c.city}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
