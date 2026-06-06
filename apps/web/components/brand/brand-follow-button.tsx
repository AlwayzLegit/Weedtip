'use client';

import { Heart } from 'lucide-react';
import { toggleBrandFollow } from '@/app/actions/brand-follow';
import { Button } from '../ui/button';

export function BrandFollowButton({
  brandId,
  slug,
  isFollowing,
}: {
  brandId: string;
  slug: string;
  isFollowing: boolean;
}) {
  const action = toggleBrandFollow.bind(null, brandId, slug);
  return (
    <form action={action}>
      <Button type="submit" variant={isFollowing ? 'primary' : 'outline'} size="md">
        <Heart className={isFollowing ? 'h-4 w-4 fill-current' : 'h-4 w-4'} />
        {isFollowing ? 'Following' : 'Follow'}
      </Button>
    </form>
  );
}
