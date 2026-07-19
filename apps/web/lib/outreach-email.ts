import 'server-only';

/**
 * Claim-invite outreach templates, shared by the batch sender and the admin
 * console's preview. Kept as plain HTML strings (not the transactional
 * emailShell) — cold outreach runs on its own subdomain sender and visual
 * identity stays deliberately simple/personal for deliverability.
 */

export type InviteEmailParams = {
  shopName: string;
  city: string | null;
  state: string;
  license: string | null;
  claimUrl: string;
  unsubscribeUrl: string;
};

const BRAND_GREEN = '#047857';

function footer(unsubscribeUrl: string): string {
  const postal = process.env.OUTREACH_POSTAL_ADDRESS ?? 'Weedtip · weedtip.com · United States';
  return `
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />
    <p style="color:#999;font-size:12px">
      ${postal}<br />
      Don't want emails about this listing?
      <a href="${unsubscribeUrl}" style="color:#999">Unsubscribe</a>
    </p>`;
}

export function inviteEmailHtml(params: InviteEmailParams): string {
  const where = params.city ? `${params.city}, ${params.state}` : params.state;
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
    <h2 style="margin:0 0 16px">Your dispensary is listed on Weedtip</h2>
    <p><strong>${params.shopName}</strong> in ${where} has a live listing on Weedtip,
    the cannabis discovery map. Shoppers nearby can already find your hours, location,
    and license details${params.license ? ` (license ${params.license} on file)` : ''}.</p>
    <p>Claiming is <strong>free forever</strong> and takes a few minutes — verified against
    the state license on file. Once claimed you control the listing:</p>
    <ul style="padding-left:20px">
      <li>Publish your menu and take pickup orders</li>
      <li>Post deals and promotions</li>
      <li>Add photos, hours, and contact info</li>
      <li>Reply to reviews</li>
    </ul>
    <p style="margin:24px 0">
      <a href="${params.claimUrl}"
         style="background:${BRAND_GREEN};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;display:inline-block">
        Claim your free listing
      </a>
    </p>
    <p style="color:#666;font-size:13px">The free listing stays free with 0% commission.
    Optional paid tools (online ordering, marketing) exist when you want them — never required.</p>
    <p style="color:#666;font-size:13px">If you don't manage this dispensary, you can ignore
    this email or pass it to the owner.</p>
    ${footer(params.unsubscribeUrl)}
  </div>`;
}

/** One-time follow-up for invites that never converted (sent ≥5 days ago). */
export function reminderEmailHtml(params: InviteEmailParams): string {
  const where = params.city ? `${params.city}, ${params.state}` : params.state;
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
    <h2 style="margin:0 0 16px">Shoppers are viewing ${params.shopName} on Weedtip</h2>
    <p>A quick follow-up: the listing for <strong>${params.shopName}</strong> in ${where}
    is live on Weedtip and unmanaged. Nearby shoppers see its hours and location today —
    but no menu, no photos, and no deals.</p>
    <p>Claiming takes a few minutes and is verified against the state license on file.
    It's free, forever, with 0% commission on orders.</p>
    <p style="margin:24px 0">
      <a href="${params.claimUrl}"
         style="background:${BRAND_GREEN};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;display:inline-block">
        Claim ${params.shopName}
      </a>
    </p>
    <p style="color:#666;font-size:13px">This is the last email about this listing unless
    you claim it. If you don't manage this dispensary, feel free to ignore it.</p>
    ${footer(params.unsubscribeUrl)}
  </div>`;
}
