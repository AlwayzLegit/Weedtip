import { ImageResponse } from 'next/og';
import { OG_SIZE, ogCard } from '@/lib/og';

export const alt = 'Weedtip — Find dispensaries near you';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    ogCard({
      eyebrow: 'Cannabis marketplace',
      title: 'Find licensed dispensaries near you',
      subtitle: 'Menus · deals · reviews · pickup & delivery',
    }),
    OG_SIZE,
  );
}
