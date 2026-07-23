import 'server-only';
import { Resend } from 'resend';
import { contactFooterLine, getPlatformSettings, PLATFORM_FALLBACK, SITE_URL } from './settings';

/**
 * Transactional email via Resend (weedtip.com is a verified sending domain).
 * Follows the integration pattern used across the app: without RESEND_API_KEY
 * every send becomes a logged no-op, so local/dev environments work end-to-end
 * with no credentials.
 *
 * Weedtip never charges shoppers, so there are no receipts — shopper email is
 * order status only. Money mail (plan/placement/slot requests) goes to the
 * sales inbox: billing is sales-led until the PaymentCloud gateway lands.
 *
 * Branding is DB-driven: templates emit %%BRAND_*%% tokens which sendEmail
 * resolves from platform_settings just before dispatch (the "From", brand name,
 * accent color, and contact footer). Change them once in /admin/settings and
 * every email — transactional AND Supabase auth — updates.
 */

const apiKey = process.env.RESEND_API_KEY;

export const isEmailConfigured = !!apiKey;

const resend = apiKey ? new Resend(apiKey) : null;

/** Where billing/sales requests land. Env overrides the DB default for routing. */
export const SALES_INBOX = process.env.SALES_EMAIL ?? PLATFORM_FALLBACK.salesEmail;

/** Resolve %%BRAND_*%% tokens in a rendered string from live platform settings. */
export async function applyBrandTokens(input: string): Promise<string> {
  const s = await getPlatformSettings();
  return input
    .replaceAll('%%BRAND_NAME%%', s.brandName)
    .replaceAll('%%BRAND_COLOR%%', s.brandColor)
    .replaceAll('%%BRAND_FOOTER%%', contactFooterLine(s))
    .replaceAll('%%BRAND_TAGLINE%%', s.tagline ?? '')
    .replaceAll('%%BRAND_LEGAL%%', s.legalName)
    .replaceAll('%%BRAND_SUPPORT_EMAIL%%', s.supportEmail)
    .replaceAll('%%BRAND_SITE_URL%%', SITE_URL)
    .replaceAll('%%BRAND_YEAR%%', String(new Date().getFullYear()));
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  /** Override the From identity (auth hook passes it explicitly); defaults to settings. */
  from?: string;
}

/** Fire one email. Returns false (never throws) when unconfigured or failed. */
export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
  from,
}: SendEmailInput): Promise<boolean> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipped "${subject}" → ${String(to)}`);
    return false;
  }
  const settings = await getPlatformSettings();
  const [resolvedSubject, resolvedHtml] = await Promise.all([
    applyBrandTokens(subject),
    applyBrandTokens(html),
  ]);
  try {
    const { error } = await resend.emails.send({
      from: from ?? process.env.EMAIL_FROM ?? settings.emailFrom,
      to: Array.isArray(to) ? to : [to],
      subject: resolvedSubject,
      html: resolvedHtml,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error(`[email] send failed for "${subject}": ${error.message}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[email] send threw for "${subject}":`, e);
    return false;
  }
}

/**
 * Shared shell so every email reads on-brand without a template engine. Uses a
 * table-based layout with inline styles (the only thing that renders reliably
 * across Gmail/Outlook/Apple Mail), a branded header (wordmark + tagline), an
 * accent-topped content card, and a complete footer (quick links, contact
 * details, legal + copyright). Brand facts come from %%BRAND_*%% tokens that
 * sendEmail resolves from platform_settings at dispatch.
 *
 * `preheader` is the hidden inbox-preview snippet; it defaults to the title.
 */
export function emailShell(title: string, bodyHtml: string, preheader?: string): string {
  const preview = (preheader ?? title)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light" />
    <title>%%BRAND_NAME%%</title>
  </head>
  <body style="margin:0;padding:0;background:#eef2ee;-webkit-text-size-adjust:100%;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${preview}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2ee;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;font-family:Arial,Helvetica,sans-serif;color:#1c2420;">
            <!-- Header -->
            <tr>
              <td style="padding:0 6px 16px;">
                <a href="%%BRAND_SITE_URL%%" style="text-decoration:none;color:%%BRAND_COLOR%%;">
                  <span style="font-size:22px;font-weight:bold;letter-spacing:-0.3px;color:%%BRAND_COLOR%%;">%%BRAND_NAME%%</span>
                </a>
                <div style="font-size:12px;color:#6b7a6f;margin-top:3px;">%%BRAND_TAGLINE%%</div>
              </td>
            </tr>
            <!-- Content card -->
            <tr>
              <td style="background:#ffffff;border:1px solid #e2e8e2;border-top:3px solid %%BRAND_COLOR%%;border-radius:14px;padding:28px;">
                <h1 style="font-size:19px;line-height:1.3;margin:0 0 14px;color:#12190f;">${title}</h1>
                <div style="font-size:15px;line-height:1.55;color:#2b352d;">${bodyHtml}</div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:20px 8px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:12px;color:#6b7a6f;line-height:1.6;padding-bottom:10px;">
                      <a href="%%BRAND_SITE_URL%%/dispensaries" style="color:%%BRAND_COLOR%%;text-decoration:none;">Find dispensaries</a>
                      &nbsp;&middot;&nbsp;
                      <a href="mailto:%%BRAND_SUPPORT_EMAIL%%" style="color:%%BRAND_COLOR%%;text-decoration:none;">Contact support</a>
                      &nbsp;&middot;&nbsp;
                      <a href="%%BRAND_SITE_URL%%/privacy" style="color:%%BRAND_COLOR%%;text-decoration:none;">Privacy</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:11px;color:#8a978c;line-height:1.7;padding-bottom:10px;">
                      %%BRAND_FOOTER%%<br/>
                      Questions? Email <a href="mailto:%%BRAND_SUPPORT_EMAIL%%" style="color:#6b7a6f;">%%BRAND_SUPPORT_EMAIL%%</a>.
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:11px;color:#9aa89c;line-height:1.7;border-top:1px solid #e2e8e2;padding-top:12px;">
                      &copy; %%BRAND_YEAR%% %%BRAND_LEGAL%%. Must be 21+. Cannabis products have intoxicating effects and have not been evaluated by the FDA. This message is not medical or legal advice.<br/>
                      You&rsquo;re receiving this because of activity on your %%BRAND_NAME%% account.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface OrderEmailInput {
  orderId: string;
  dispensaryName: string;
  orderType: string;
  /** How the shopper said they'll pay the store (cash/debit) — informational. */
  paymentMethod?: string;
  totalCents: number;
  itemCount: number;
  siteUrl: string;
}

const METHOD_LABEL: Record<string, string> = { cash: 'cash', debit: 'debit card', card: 'card' };

/** Shopper confirmation — status only; Weedtip never collects payment. */
export function orderConfirmationEmail(o: OrderEmailInput): { subject: string; html: string } {
  const method = METHOD_LABEL[o.paymentMethod ?? ''] ?? 'cash or debit';
  const payLine =
    o.orderType === 'delivery'
      ? `You pay the delivery driver (${method}) when your order arrives.`
      : `You pay at the store (${method}) when you pick up.`;
  return {
    subject: `Order received — ${o.dispensaryName}`,
    html: emailShell(
      'Your order is in',
      `<p style="margin:0 0 8px;">${o.dispensaryName} received your ${o.orderType} order of ${o.itemCount} item${o.itemCount === 1 ? '' : 's'} (${money(o.totalCents)} estimated total).</p>
       <p style="margin:0 0 8px;">${payLine} Bring a valid 21+ ID.</p>
       <p style="margin:16px 0 0;"><a href="${o.siteUrl}/orders/${o.orderId}" style="color:%%BRAND_COLOR%%;">Track your order</a></p>`,
    ),
  };
}

/** Heads-up to the dispensary that a new order needs confirming. */
export function newOrderForDispensaryEmail(o: OrderEmailInput): { subject: string; html: string } {
  const method = METHOD_LABEL[o.paymentMethod ?? ''] ?? 'in person';
  return {
    subject: `New ${o.orderType} order on Weedtip`,
    html: emailShell(
      'You have a new order',
      `<p style="margin:0 0 8px;">A shopper placed a ${o.orderType} order — ${o.itemCount} item${o.itemCount === 1 ? '' : 's'}, ${money(o.totalCents)} estimated total, paying by <strong>${method}</strong>. Payment is collected by you ${o.orderType === 'delivery' ? 'via your delivery partner' : 'at the counter'}; Weedtip takes 0% commission.</p>
       <p style="margin:16px 0 0;"><a href="${o.siteUrl}/dashboard/orders" style="color:%%BRAND_COLOR%%;">Confirm it in your dashboard</a></p>`,
    ),
  };
}

// ─── Sales-led billing requests ───────────────────────────────────────────────

export interface BillingRequestInput {
  kind: string;
  requester: string;
  details: Record<string, string | number>;
  siteUrl: string;
}

/** Internal notification: someone wants to give us money — activate + invoice. */
export function billingRequestEmail(r: BillingRequestInput): { subject: string; html: string } {
  const rows = Object.entries(r.details)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7a6f;">${k}</td><td style="padding:4px 0;">${v}</td></tr>`,
    )
    .join('');
  return {
    subject: `[Billing] ${r.kind} — ${r.requester}`,
    html: emailShell(
      `New ${r.kind} request`,
      `<p style="margin:0 0 8px;">${r.requester} requested: <strong>${r.kind}</strong>.</p>
       <table style="font-size:14px;border-collapse:collapse;">${rows}</table>
       <p style="margin:16px 0 0;"><a href="${r.siteUrl}/admin/billing" style="color:%%BRAND_COLOR%%;">Review in the billing console</a></p>`,
    ),
  };
}

/** Acknowledgement to the requester — sets the "sales will reach out" expectation. */
export function billingRequestAckEmail(kind: string): { subject: string; html: string } {
  return {
    subject: `We got your ${kind} request`,
    html: emailShell(
      'Request received',
      `<p style="margin:0 0 8px;">Thanks — your <strong>${kind}</strong> request is in. Our team will confirm details and set up billing within 1 business day. Nothing is charged until you approve.</p>
       <p style="margin:0;">Questions? Just reply to this email.</p>`,
    ),
  };
}

// ─── Team invites ─────────────────────────────────────────────────────────────

export function teamInviteEmail(
  dispensaryName: string,
  role: string,
  siteUrl: string,
): { subject: string; html: string } {
  return {
    subject: `You're invited to ${dispensaryName} on %%BRAND_NAME%%`,
    html: emailShell(
      'Team invitation',
      `<p style="margin:0 0 8px;">You've been invited to join <strong>${dispensaryName}</strong> on %%BRAND_NAME%% as a <strong>${role}</strong>.</p>
       <p style="margin:0 0 8px;">Sign in with this email address and accept the invite to get access.</p>
       <p style="margin:16px 0 0;"><a href="${siteUrl}/invites" style="color:%%BRAND_COLOR%%;">Accept your invite</a></p>`,
    ),
  };
}

// ─── Supabase auth emails (via the Send Email Hook) ───────────────────────────

/** A big branded CTA button linking to the auth confirmation/verification URL. */
function ctaButton(url: string, label: string): string {
  return `<p style="margin:20px 0;">
    <a href="${url}" style="display:inline-block;background:%%BRAND_COLOR%%;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;">${label}</a>
  </p>`;
}

/** A monospace OTP code block for manual entry / reauthentication. */
function otpBlock(otp: string): string {
  return `<p style="margin:16px 0 4px;color:#6b7a6f;font-size:13px;">Or use this code:</p>
    <p style="margin:0;font-family:monospace;font-size:26px;letter-spacing:4px;font-weight:bold;">${otp}</p>`;
}

export type AuthEmailKind =
  | 'signup'
  | 'magiclink'
  | 'recovery'
  | 'invite'
  | 'email_change'
  | 'reauthentication';

/**
 * Branded rendering for the emails Supabase Auth would otherwise send unbranded
 * (confirm signup, magic link, password reset, invite, email change, reauth).
 * Driven by the Send Email Hook — see app/api/auth/send-email/route.ts.
 */
export function authEmail(
  kind: AuthEmailKind,
  opts: { url?: string; otp?: string },
): { subject: string; html: string } {
  const url = opts.url ?? '#';
  const otp = opts.otp;
  const withOtp = otp ? otpBlock(otp) : '';

  switch (kind) {
    case 'signup':
      return {
        subject: 'Confirm your email · %%BRAND_NAME%%',
        html: emailShell(
          'Confirm your email',
          `<p style="margin:0 0 8px;">Welcome to %%BRAND_NAME%%! Confirm your email address to activate your account.</p>
           ${ctaButton(url, 'Confirm email')}
           ${withOtp}
           <p style="margin:16px 0 0;color:#6b7a6f;font-size:12px;">If you didn't create an account, you can safely ignore this email.</p>`,
        ),
      };
    case 'magiclink':
      return {
        subject: 'Your %%BRAND_NAME%% sign-in link',
        html: emailShell(
          'Sign in to %%BRAND_NAME%%',
          `<p style="margin:0 0 8px;">Click below to sign in. This link expires shortly and can be used once.</p>
           ${ctaButton(url, 'Sign in')}
           ${withOtp}
           <p style="margin:16px 0 0;color:#6b7a6f;font-size:12px;">If you didn't request this, you can ignore it.</p>`,
        ),
      };
    case 'recovery':
      return {
        subject: 'Reset your %%BRAND_NAME%% password',
        html: emailShell(
          'Reset your password',
          `<p style="margin:0 0 8px;">We received a request to reset your password. Click below to choose a new one.</p>
           ${ctaButton(url, 'Reset password')}
           ${withOtp}
           <p style="margin:16px 0 0;color:#6b7a6f;font-size:12px;">If you didn't request this, your password is unchanged — you can ignore this email.</p>`,
        ),
      };
    case 'invite':
      return {
        subject: "You're invited to %%BRAND_NAME%%",
        html: emailShell(
          "You've been invited",
          `<p style="margin:0 0 8px;">You've been invited to join %%BRAND_NAME%%. Accept the invite to set up your account.</p>
           ${ctaButton(url, 'Accept invite')}
           ${withOtp}`,
        ),
      };
    case 'email_change':
      return {
        subject: 'Confirm your new email · %%BRAND_NAME%%',
        html: emailShell(
          'Confirm your new email',
          `<p style="margin:0 0 8px;">Confirm this address to finish changing the email on your %%BRAND_NAME%% account.</p>
           ${ctaButton(url, 'Confirm email change')}
           ${withOtp}`,
        ),
      };
    case 'reauthentication':
      return {
        subject: 'Your %%BRAND_NAME%% verification code',
        html: emailShell(
          'Verify it’s you',
          `<p style="margin:0 0 8px;">Enter this code to confirm your identity.</p>
           <p style="margin:8px 0;font-family:monospace;font-size:30px;letter-spacing:6px;font-weight:bold;">${otp ?? ''}</p>
           <p style="margin:16px 0 0;color:#6b7a6f;font-size:12px;">If you didn't request this, you can ignore it.</p>`,
        ),
      };
  }
}

// ─── Welcome (sent once, on first email confirmation) ─────────────────────────

/** Shopper welcome — orients a new consumer around finding shops + saving deals. */
export function welcomeShopperEmail(
  name: string | null,
  siteUrl: string,
): { subject: string; html: string } {
  const hi = name ? `Hi ${name},` : 'Welcome,';
  return {
    subject: 'Welcome to Weedtip 🌿',
    html: emailShell(
      'Welcome to Weedtip',
      `<p style="margin:0 0 8px;">${hi} you're all set. Weedtip helps you find nearby dispensaries, compare menus, and grab the best deals near you.</p>
       <ul style="margin:0 0 8px;padding-left:18px;">
         <li style="margin:0 0 4px;">Browse shops near you and save your favorites</li>
         <li style="margin:0 0 4px;">Track live deals and price drops</li>
         <li>You always pay the shop or driver directly — Weedtip never charges you</li>
       </ul>
       <p style="margin:16px 0 0;"><a href="${siteUrl}/dispensaries" style="color:%%BRAND_COLOR%%;">Find dispensaries near you</a></p>`,
    ),
  };
}

/** Business welcome — points a new dispensary-owner account to claim/create. */
export function welcomeBusinessEmail(
  name: string | null,
  siteUrl: string,
): { subject: string; html: string } {
  const hi = name ? `Hi ${name},` : 'Welcome,';
  return {
    subject: 'Welcome to Weedtip for business',
    html: emailShell(
      'Get your dispensary on Weedtip',
      `<p style="margin:0 0 8px;">${hi} thanks for creating a business account. Here's how to go live:</p>
       <ol style="margin:0 0 8px;padding-left:18px;">
         <li style="margin:0 0 4px;">Find your shop in our directory and claim it — we verify against the state license on file</li>
         <li style="margin:0 0 4px;">Not listed yet? Create your listing from scratch</li>
         <li>Add your menu, hours, and deals to start getting orders</li>
       </ol>
       <p style="margin:0 0 8px;">Free forever, 0% commission on orders.</p>
       <p style="margin:16px 0 0;"><a href="${siteUrl}/claim" style="color:%%BRAND_COLOR%%;">Claim or create your listing</a></p>`,
    ),
  };
}

/** Brand welcome — points a brand-intent account to claim/create a brand. */
export function welcomeBrandEmail(
  name: string | null,
  siteUrl: string,
): { subject: string; html: string } {
  const hi = name ? `Hi ${name},` : 'Welcome,';
  return {
    subject: 'Welcome to Weedtip for brands',
    html: emailShell(
      'Put your brand in front of shoppers',
      `<p style="margin:0 0 8px;">${hi} thanks for joining. A Weedtip brand page enriches every dispensary menu that carries your products.</p>
       <ol style="margin:0 0 8px;padding-left:18px;">
         <li style="margin:0 0 4px;">Find and claim your brand — or create it if it's new to Weedtip</li>
         <li style="margin:0 0 4px;">Add your logo, story, and product catalog</li>
         <li>See where you're carried and reach new shoppers</li>
       </ol>
       <p style="margin:16px 0 0;"><a href="${siteUrl}/for-brands" style="color:%%BRAND_COLOR%%;">Get started with your brand</a></p>`,
    ),
  };
}

// ─── Brand claims ─────────────────────────────────────────────────────────────

export function brandClaimSubmittedEmail(brandName: string): { subject: string; html: string } {
  return {
    subject: `Claim received — ${brandName}`,
    html: emailShell(
      'Your brand claim is under review',
      `<p style="margin:0 0 8px;">We received your request to claim <strong>${brandName}</strong> on Weedtip. Our team reviews brand claims and typically responds within 1–2 business days.</p>`,
    ),
  };
}

export function brandClaimDecisionEmail(
  brandName: string,
  approved: boolean,
  siteUrl: string,
): { subject: string; html: string } {
  return approved
    ? {
        subject: `You now manage ${brandName} on Weedtip`,
        html: emailShell(
          'Brand claim approved 🎉',
          `<p style="margin:0 0 8px;">Your claim for <strong>${brandName}</strong> was approved. You can now manage your brand profile, media, and product catalog in Brand Studio.</p>
           <p style="margin:16px 0 0;"><a href="${siteUrl}/studio" style="color:%%BRAND_COLOR%%;">Open Brand Studio</a></p>`,
        ),
      }
    : {
        subject: `Update on your brand claim for ${brandName}`,
        html: emailShell(
          'Brand claim not approved',
          `<p style="margin:0 0 8px;">We couldn't verify your claim for <strong>${brandName}</strong>. If you believe this is a mistake, reply with details about your role at the brand and we'll take another look.</p>`,
        ),
      };
}

/** Notify sales that a brand was created and needs review to go live. */
export function brandCreatedEmail(
  brandName: string,
  requester: string,
  siteUrl: string,
): { subject: string; html: string } {
  return {
    subject: `[Brands] New brand submitted — ${brandName}`,
    html: emailShell(
      'New brand awaiting review',
      `<p style="margin:0 0 8px;">${requester} created <strong>${brandName}</strong>. It's pending until an admin approves it.</p>
       <p style="margin:16px 0 0;"><a href="${siteUrl}/admin/brands" style="color:%%BRAND_COLOR%%;">Review in admin</a></p>`,
    ),
  };
}

// ─── Listing claims ───────────────────────────────────────────────────────────

export function claimSubmittedEmail(dispensaryName: string): { subject: string; html: string } {
  return {
    subject: `Claim received — ${dispensaryName}`,
    html: emailShell(
      'Your claim is under review',
      `<p style="margin:0 0 8px;">We received your request to claim <strong>${dispensaryName}</strong> on Weedtip. Our team verifies license details and typically responds within 1–2 business days.</p>`,
    ),
  };
}

export function claimDecisionEmail(
  dispensaryName: string,
  approved: boolean,
  siteUrl: string,
): { subject: string; html: string } {
  return approved
    ? {
        subject: `You now manage ${dispensaryName} on Weedtip`,
        html: emailShell(
          'Claim approved 🎉',
          `<p style="margin:0 0 8px;">Your claim for <strong>${dispensaryName}</strong> was approved. You can now manage your menu, photos, hours, deals, and orders.</p>
           <p style="margin:16px 0 0;"><a href="${siteUrl}/dashboard" style="color:%%BRAND_COLOR%%;">Open your dashboard</a></p>`,
        ),
      }
    : {
        subject: `Update on your claim for ${dispensaryName}`,
        html: emailShell(
          'Claim not approved',
          `<p style="margin:0 0 8px;">We couldn't verify your claim for <strong>${dispensaryName}</strong>. If you believe this is a mistake, reply with your license number and business documents and we'll take another look.</p>`,
        ),
      };
}
