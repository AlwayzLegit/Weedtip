import { Link } from 'next-view-transitions';
import { MediaImage } from '../media-image';

export type LineupItem = {
  id: string;
  name: string;
  strainType: string | null;
  thcPercentage: number | null;
  description: string | null;
  imageUrl: string | null;
  brandName: string;
  brandSlug: string;
  brandLogoUrl: string | null;
};

/**
 * A brand-catalog product card (official lineup item, not store inventory).
 * Links to the brand page, where "Carried at" shows where to buy it.
 */
export function LineupCard({ item }: { item: LineupItem }) {
  return (
    <Link
      href={`/brand/${item.brandSlug}`}
      prefetch={false}
      className="rounded-card border-border bg-surface shadow-card hover:border-primary/50 hover:shadow-card-hover group block overflow-hidden border transition-all duration-200 hover:-translate-y-0.5"
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.name}
          className="bg-surface-2 h-32 w-full object-cover"
        />
      ) : (
        // Same on-brand placeholder frame the rest of the card family uses,
        // tinted per item so catalogs without photos still read as designed.
        <MediaImage
          url={null}
          alt={item.name}
          artSeed={item.name}
          className="h-32"
          iconClassName="h-10 w-10"
        />
      )}
      <div className="p-3">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="text-muted mt-0.5 truncate text-xs capitalize">
          {item.strainType ?? ''}
          {item.thcPercentage != null
            ? `${item.strainType ? ' · ' : ''}${item.thcPercentage}% THC`
            : ''}
        </p>
        <p className="text-primary mt-1.5 flex items-center gap-1.5 text-xs font-medium">
          {item.brandLogoUrl ? (
            <img
              src={item.brandLogoUrl}
              alt=""
              className="border-border h-4 w-4 rounded border object-contain"
            />
          ) : null}
          by {item.brandName}
        </p>
      </div>
    </Link>
  );
}
