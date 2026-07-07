'use client';

import { Heart } from 'lucide-react';
import { toggleFavorite } from '@/app/actions/favorites';
import { track } from '@/lib/analytics';
import { Button } from './ui/button';

export function FavoriteButton({
  dispensaryId,
  slug,
  isFavorite,
}: {
  dispensaryId: string;
  slug: string;
  isFavorite: boolean;
}) {
  const action = toggleFavorite.bind(null, dispensaryId, slug);
  return (
    <form action={action}>
      <Button
        type="submit"
        variant={isFavorite ? 'primary' : 'outline'}
        size="md"
        onClick={() =>
          track(isFavorite ? 'favorite_removed' : 'favorite_added', {
            kind: 'dispensary',
            dispensary_id: dispensaryId,
            slug,
          })
        }
      >
        <Heart className={isFavorite ? 'h-4 w-4 fill-current' : 'h-4 w-4'} />
        {isFavorite ? 'Saved' : 'Save'}
      </Button>
    </form>
  );
}
