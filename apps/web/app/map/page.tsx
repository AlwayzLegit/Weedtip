import { permanentRedirect } from 'next/navigation';

/**
 * Retired (redesign Phase 1): the map now lives inside /dispensaries as the
 * map-first split view. Preserve old deep links, including ?state= chips.
 */
export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  permanentRedirect(
    state ? `/dispensaries?state=${encodeURIComponent(state.toUpperCase())}` : '/dispensaries',
  );
}
