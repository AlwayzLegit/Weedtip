import 'server-only';
import { Resend } from 'resend';

/**
 * Transactional email via Resend (weedtip.com is a verified sending domain).
 * Follows the integration pattern used across the app: without RESEND_API_KEY
 * every send becomes a logged no-op, so local/dev environments work end-to-end
 * with no credentials.
 *
 * Weedtip never charges shoppers, so there are no receipts — shopper email is
 * order status only. Money mail (plan/placement/slot requests) goes to the
 * sales inbox: billing is sales-led until the PaymentCloud gateway lands.
 */

const apiKey = process.env.RESEND_API_KEY;

export const isEmailConfigured = !!apiKey;

const resend = apiKey ? new Resend(apiKey) : null;

const FROM = process.env.EMAIL_FROM ?? 'Weedtip <notifications@weedtip.com>';

/** Where billing/sales requests land. */
export const SALES_INBOX = process.env.SALES_EMAIL ?? 'sales@weedtip.com';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

/** Fire one email. Returns false (never throws) when unconfigured or failed. */
export async function sendEmail({ to, subject, html, replyTo }: SendEmailInput): Promise<boolean> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipped "${subject}" → ${String(to)}`);
    return false;
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
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

/** Shared shell so every email reads as Weedtip without a template engine. */
export function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f6f4;font-family:Arial,Helvetica,sans-serif;color:#1c2420;">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
      <p style="font-size:20px;font-weight:bold;color:#1a7f4e;margin:0 0 16px;">Weedtip</p>
      <div style="background:#ffffff;border:1px solid #e2e8e2;border-radius:12px;padding:24px;">
        <h1 style="font-size:18px;margin:0 0 12px;">${title}</h1>
        ${bodyHtml}
      </div>
      <p style="font-size:11px;color:#6b7a6f;margin:16px 0 0;">
        Weedtip · North Hollywood, CA 91606 · (747) 250-4446<br/>
        You're receiving this because of activity on your Weedtip account.
      </p>
    </div>
  </body>
</html>`;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface OrderEmailInput {
  orderId: string;
  dispensaryName: string;
  orderType: string;
  totalCents: number;
  itemCount: number;
  siteUrl: string;
}

/** Shopper confirmation — status only; Weedtip never collects payment. */
export function orderConfirmationEmail(o: OrderEmailInput): { subject: string; html: string } {
  const payLine =
    o.orderType === 'delivery'
      ? 'You pay the delivery driver when your order arrives.'
      : 'You pay at the store when you pick up.';
  return {
    subject: `Order received — ${o.dispensaryName}`,
    html: emailShell(
      'Your order is in',
      `<p style="margin:0 0 8px;">${o.dispensaryName} received your ${o.orderType} order of ${o.itemCount} item${o.itemCount === 1 ? '' : 's'} (${money(o.totalCents)} estimated total).</p>
       <p style="margin:0 0 8px;">${payLine} Bring a valid 21+ ID.</p>
       <p style="margin:16px 0 0;"><a href="${o.siteUrl}/orders/${o.orderId}" style="color:#1a7f4e;">Track your order</a></p>`,
    ),
  };
}

/** Heads-up to the dispensary that a new order needs confirming. */
export function newOrderForDispensaryEmail(o: OrderEmailInput): { subject: string; html: string } {
  return {
    subject: `New ${o.orderType} order on Weedtip`,
    html: emailShell(
      'You have a new order',
      `<p style="margin:0 0 8px;">A shopper placed a ${o.orderType} order — ${o.itemCount} item${o.itemCount === 1 ? '' : 's'}, ${money(o.totalCents)} estimated total. Payment is collected by you ${o.orderType === 'delivery' ? 'via your delivery partner' : 'at the counter'}; Weedtip takes 0% commission.</p>
       <p style="margin:16px 0 0;"><a href="${o.siteUrl}/dashboard/orders" style="color:#1a7f4e;">Confirm it in your dashboard</a></p>`,
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
       <p style="margin:16px 0 0;"><a href="${r.siteUrl}/admin/billing" style="color:#1a7f4e;">Review in the billing console</a></p>`,
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
           <p style="margin:16px 0 0;"><a href="${siteUrl}/dashboard" style="color:#1a7f4e;">Open your dashboard</a></p>`,
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
