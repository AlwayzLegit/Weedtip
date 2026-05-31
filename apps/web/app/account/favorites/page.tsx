import type { Metadata } from 'next';
import Link from 'next/link';
import { DispensaryCard } from '@/components/dispensary-card';
import { getAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Favorites' };

export default async function FavoritesPage() {
  const { user } = await getAuth();
  if (!user) return null;

  const supabase = await createClient();
  // RLS: favorites are self-only; the joined dispensary is visible if active.
  const { data: favorites } = await supabase
    .from('favorites')
    .select(
      'created_at, dispensary:dispensaries(slug,name,city,state,cover_image_url,is_delivery,is_pickup,is_medical,is_recreational,featured,status,rating_avg,rating_count)',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const shops = (favorites ?? [])
    .map((f) => f.dispensary as NonNullable<typeof f.dispensary>)
    .filter((d): d is NonNullable<typeof d> => !!d && d.status === 'active');

  if (shops.length === 0) {
    return (
      <div className="rounded-card border-border bg-surface border p-10 text-center">
        <p className="font-medium">No favorites yet</p>
        <p className="text-muted mt-1 text-sm">Tap “Save” on a dispensary to bookmark it.</p>
        <Link
          href="/dispensaries"
          className="text-primary mt-4 inline-block text-sm hover:underline"
        >
          Browse dispensaries
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {shops.map((d) => (
        <DispensaryCard
          key={d.slug}
          d={{
            slug: d.slug,
            name: d.name,
            city: d.city,
            state: d.state,
            coverImageUrl: d.cover_image_url,
            isDelivery: d.is_delivery,
            isPickup: d.is_pickup,
            isMedical: d.is_medical,
            isRecreational: d.is_recreational,
            featured: d.featured,
            rating: d.rating_avg,
            reviewCount: d.rating_count,
          }}
        />
      ))}
    </div>
  );
}
