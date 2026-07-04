import { createClient } from '@supabase/supabase-js';
import { getPublicSupabaseConfig } from '@weedtip/supabase/config';
import { ImageResponse } from 'next/og';
import { OG_SIZE, ogCard } from '@/lib/og';

export const alt = 'Dispensary on Weedtip';
export const size = OG_SIZE;
export const contentType = 'image/png';

// Cookieless anon client — public data only, runs in the OG image runtime.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { url, anonKey } = getPublicSupabaseConfig();
  const supabase = createClient(url, anonKey);
  const { data } = await supabase
    .from('dispensaries')
    .select('name,city,state')
    .eq('slug', slug)
    .maybeSingle();

  return new ImageResponse(
    ogCard({
      eyebrow: 'Dispensary',
      title: data?.name ?? 'Dispensary',
      subtitle: data
        ? [data.city, data.state].filter(Boolean).join(', ') || undefined
        : undefined,
    }),
    OG_SIZE,
  );
}
