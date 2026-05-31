'use client';

import { Star } from 'lucide-react';
import { setDispensaryFeatured, setDispensaryStatus } from '@/app/admin/actions';
import { Button } from '../ui/button';

export function ModerationButtons({
  id,
  status,
  featured,
}: {
  id: string;
  status: string;
  featured: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== 'active' && (
        <form action={setDispensaryStatus.bind(null, id, 'active')}>
          <Button type="submit" size="sm">
            {status === 'suspended' ? 'Reactivate' : 'Approve'}
          </Button>
        </form>
      )}
      {status !== 'suspended' && (
        <form action={setDispensaryStatus.bind(null, id, 'suspended')}>
          <Button type="submit" size="sm" variant="outline">
            Suspend
          </Button>
        </form>
      )}
      <form action={setDispensaryFeatured.bind(null, id, !featured)}>
        <Button
          type="submit"
          size="sm"
          variant={featured ? 'primary' : 'ghost'}
          aria-pressed={featured}
        >
          <Star className={featured ? 'h-4 w-4 fill-current' : 'h-4 w-4'} />
          {featured ? 'Featured' : 'Feature'}
        </Button>
      </form>
    </div>
  );
}
