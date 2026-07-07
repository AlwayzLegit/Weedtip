'use client';

import { Link } from 'next-view-transitions';
import { useState, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { toggleStrainFavorite } from '@/app/actions/strains';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

export function StrainFavoriteButton({
  strainId,
  slug,
  initialSaved,
  initialCount,
  isAuthed,
}: {
  strainId: string;
  slug: string;
  initialSaved: boolean;
  initialCount: number;
  isAuthed: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [count, setCount] = useState(initialCount);
  const [pending, start] = useTransition();

  if (!isAuthed) {
    return (
      <Link
        href={`/sign-in?next=/strain/${slug}`}
        className="border-border hover:bg-surface-2 hover:border-border-strong inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors"
      >
        <Heart className="h-4 w-4" />
        Save · {count}
      </Link>
    );
  }

  return (
    <Button
      variant={saved ? 'primary' : 'outline'}
      size="sm"
      disabled={pending}
      onClick={() => {
        // Optimistic flip.
        const next = !saved;
        setSaved(next);
        setCount((c) => c + (next ? 1 : -1));
        track(next ? 'favorite_added' : 'favorite_removed', {
          kind: 'strain',
          strain_id: strainId,
          slug,
        });
        start(async () => {
          const res = await toggleStrainFavorite(strainId, slug);
          if (!res.ok || res.saved === undefined) {
            // Revert on failure.
            setSaved(!next);
            setCount((c) => c + (next ? -1 : 1));
          } else if (res.saved !== next) {
            setSaved(res.saved);
          }
        });
      }}
    >
      <Heart className={cn('mr-1.5 h-4 w-4', saved && 'fill-current')} />
      {saved ? 'Saved' : 'Save'} · {count}
    </Button>
  );
}
