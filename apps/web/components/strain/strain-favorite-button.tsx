'use client';

import { Link } from 'next-view-transitions';
import { useEffect, useState, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { toggleStrainFavorite } from '@/app/actions/strains';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

/**
 * Save button on the strain page. The page is static/ISR and renders with a
 * cookieless client, so auth and the viewer's saved state must resolve HERE in
 * the browser — a server-passed isAuthed would bake "signed out" into the
 * cached HTML for every visitor and bounce logged-in users to /sign-in.
 */
export function StrainFavoriteButton({
  strainId,
  slug,
  initialCount,
}: {
  strainId: string;
  slug: string;
  initialCount: number;
}) {
  const [saved, setSaved] = useState(false);
  // null = still resolving; render the signed-out link until proven otherwise.
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [count, setCount] = useState(initialCount);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setAuthed(!!user);
      if (user) {
        const { data: fav } = await supabase
          .from('strain_favorites')
          .select('strain_id')
          .eq('strain_id', strainId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled) setSaved(!!fav);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [strainId]);

  if (!authed) {
    return (
      <Link
        href={`/sign-in?next=/strain/${slug}`}
        className="border-border hover:bg-surface-2 hover:border-border-strong inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors"
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
