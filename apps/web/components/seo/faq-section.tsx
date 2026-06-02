import { faqJsonLd } from '@/lib/seo';
import { JsonLd } from './json-ld';

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Visible FAQ block + matching FAQPage JSON-LD (Google FAQ rich results).
 * Common on local/category landing pages for SEO content depth.
 */
export function FaqSection({
  items,
  heading = 'Frequently asked questions',
}: {
  items: FaqItem[];
  heading?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12">
      <JsonLd data={faqJsonLd(items)} />
      <h2 className="mb-4 text-lg font-semibold">{heading}</h2>
      <dl className="space-y-3">
        {items.map((it) => (
          <div key={it.question} className="rounded-card border-border bg-surface border p-4">
            <dt className="font-medium">{it.question}</dt>
            <dd className="text-muted mt-1 text-sm leading-relaxed">{it.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
