import { formatPrice } from '@/lib/format';
import { SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

function shell(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Inter, sans-serif;
    background:#0B0D12; color:#F4F6F8; -webkit-font-smoothing:antialiased; }
  .wrap { max-width: 680px; margin: 0 auto; padding: 16px; }
  .head { display:flex; align-items:baseline; justify-content:space-between; gap:12px;
    padding-bottom:12px; border-bottom:1px solid #2A2F3C; margin-bottom:12px; }
  .head h1 { font-size:18px; margin:0; }
  .head span { color:#9AA3B2; font-size:12px; }
  ul { list-style:none; margin:0; padding:0; }
  li a { display:flex; align-items:center; justify-content:space-between; gap:12px;
    padding:12px; border:1px solid #2A2F3C; border-radius:12px; margin-bottom:8px;
    text-decoration:none; color:inherit; background:#161922; transition:border-color .15s; }
  li a:hover { border-color:rgba(16,185,129,.5); }
  .name { font-weight:600; font-size:14px; }
  .brand { color:#9AA3B2; font-size:12px; }
  .price { font-weight:600; color:#10B981; white-space:nowrap; }
  .was { color:#9AA3B2; font-size:12px; text-decoration:line-through; margin-right:6px; }
  .foot { text-align:center; padding:14px 0 4px; }
  .foot a { color:#10B981; font-size:12px; text-decoration:none; }
  .empty { color:#9AA3B2; text-align:center; padding:32px 0; }
</style></head><body><div class="wrap">${body}</div></body></html>`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: d } = await supabase
    .from('dispensaries')
    .select('id,name,slug,city,state,status')
    .eq('slug', slug)
    .maybeSingle();

  const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' };

  if (!d || d.status !== 'active') {
    return new Response(shell('Menu unavailable', '<p class="empty">This menu is unavailable.</p>'), {
      status: 404,
      headers,
    });
  }

  const [{ data: products }, { data: sales }] = await Promise.all([
    supabase
      .from('products')
      .select('id,name,brand,price_cents')
      .eq('dispensary_id', d.id)
      .eq('in_stock', true)
      .order('name')
      .limit(100),
    supabase.rpc('dispensary_sale_prices', { p_dispensary_id: d.id }),
  ]);

  const saleByProduct = new Map((sales ?? []).map((s) => [s.product_id, s.sale_cents] as const));

  const rows = (products ?? [])
    .map((p) => {
      const sale = saleByProduct.get(p.id);
      const price = sale ?? p.price_cents;
      const priceHtml = sale
        ? `<span class="price"><span class="was">${formatPrice(p.price_cents)}</span>${formatPrice(price)}</span>`
        : `<span class="price">${formatPrice(price)}</span>`;
      return `<li><a href="${SITE_URL}/product/${p.id}" target="_blank" rel="noopener">
        <span><span class="name">${esc(p.name)}</span>${p.brand ? `<br/><span class="brand">${esc(p.brand)}</span>` : ''}</span>
        ${priceHtml}</a></li>`;
    })
    .join('');

  const body = `
    <div class="head">
      <h1>${esc(d.name)}</h1>
      <span>${esc(d.city)}, ${esc(d.state)}</span>
    </div>
    ${rows ? `<ul>${rows}</ul>` : '<p class="empty">No products listed yet.</p>'}
    <div class="foot"><a href="${SITE_URL}/dispensary/${esc(d.slug)}" target="_blank" rel="noopener">View full menu &amp; order on Weedtip →</a></div>`;

  return new Response(shell(`${d.name} — Menu`, body), { headers });
}
