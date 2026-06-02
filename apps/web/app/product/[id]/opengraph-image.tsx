import { createClient } from '@supabase/supabase-js';
import { getPublicSupabaseConfig } from '@weedtip/supabase/config';
import { ImageResponse } from 'next/og';
import { OG_SIZE, ogCard } from '@/lib/og';

export const alt = 'Product on Weedtip';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { url, anonKey } = getPublicSupabaseConfig();
  const supabase = createClient(url, anonKey);
  const { data } = await supabase
    .from('products')
    .select('name,brand')
    .eq('id', id)
    .maybeSingle();

  return new ImageResponse(
    ogCard({
      eyebrow: data?.brand ?? 'Product',
      title: data?.name ?? 'Product',
      subtitle: 'See price, THC/CBD, reviews & where to buy',
    }),
    OG_SIZE,
  );
}
