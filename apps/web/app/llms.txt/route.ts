import { ARTICLES } from '@/lib/learn';
import { activeStateCounts } from '@/lib/locations';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

// Refresh daily — the state counts and guide list change slowly.
export const revalidate = 86400;

/**
 * /llms.txt — a curated, machine-readable map of the site for AI search and
 * LLM crawlers (llmstxt.org). For a young directory that can't yet rank in
 * Google, AI-assisted discovery is a real acquisition channel; this gives those
 * agents an accurate, link-rich summary of what Weedtip is and its main hubs.
 * Also clears the Semrush "Llms.txt not found" audit notice.
 */
export async function GET() {
  const states = await activeStateCounts();
  const topStates = states.slice(0, 10);
  const guides = ARTICLES.slice(0, 12);

  const lines = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    'Weedtip is a marketing directory only: it lists licensed cannabis dispensaries, ' +
      'delivery services, brands, products, and strains — with menus, prices, deals, hours, ' +
      'and reviews. It does not sell cannabis or process orders.',
    '',
    '## Browse',
    `- [Dispensaries (live map)](${SITE_URL}/dispensaries): search licensed dispensaries near any location`,
    `- [Dispensaries by state](${SITE_URL}/dispensaries/locations): the full state → city directory`,
    `- [Cannabis delivery](${SITE_URL}/deliveries): services that deliver, matched by county`,
    `- [Deals](${SITE_URL}/deals): current dispensary discounts`,
    `- [Brands](${SITE_URL}/brands): cannabis brands and where to buy them`,
    `- [Products](${SITE_URL}/products): browse products by category`,
    `- [Strains](${SITE_URL}/strains): strain library with effects, flavors, and THC ranges`,
    '',
    '## Top states',
    ...topStates.map(
      (s) =>
        `- [${s.name} dispensaries](${SITE_URL}/dispensaries/${s.code.toLowerCase()}): ${s.count.toLocaleString()} licensed listings`,
    ),
    '',
    '## Guides',
    ...guides.map((a) => `- [${a.title}](${SITE_URL}/learn/${a.slug})`),
    '',
    '## Notes',
    '- For adults 21 and older. Cannabis products have not been evaluated by the FDA.',
    '- Availability, delivery, and legality vary by state and locality.',
    '',
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
