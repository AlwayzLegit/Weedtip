import { Link } from 'next-view-transitions';
import { BookOpen, Clock } from 'lucide-react';
import { MediaImage } from './media-image';

export interface ArticleCardData {
  slug: string;
  topic: string;
  title: string;
  description: string;
  readMinutes: number;
}

/**
 * Editorial card for Learn guides. A seeded gradient art header (varied per
 * article via the title) gives the rail visual weight instead of a wall of
 * text; the body carries topic, title, teaser, and read time.
 */
export function ArticleCard({ a }: { a: ArticleCardData }) {
  return (
    <Link
      href={`/learn/${a.slug}`}
      className="rounded-card border-border bg-surface shadow-card hover:border-primary/50 hover:shadow-card-hover group flex h-full flex-col overflow-hidden border transition-all duration-200 hover:-translate-y-0.5"
    >
      <MediaImage
        url={null}
        artSeed={a.title}
        artIcon={
          <BookOpen
            className="text-foreground/25 h-9 w-9 transition-transform duration-300 group-hover:scale-110"
            strokeWidth={1.5}
          />
        }
        className="h-28"
      />
      <div className="flex flex-1 flex-col p-4">
        <p className="text-primary text-xs font-semibold uppercase tracking-wide">{a.topic}</p>
        <h3 className="group-hover:text-primary mt-1 font-semibold leading-snug transition-colors">
          {a.title}
        </h3>
        <p className="text-muted mt-1.5 line-clamp-2 text-sm leading-relaxed">{a.description}</p>
        <p className="text-muted mt-auto flex items-center gap-1 pt-3 text-xs">
          <Clock className="h-3.5 w-3.5" /> {a.readMinutes} min read
        </p>
      </div>
    </Link>
  );
}
