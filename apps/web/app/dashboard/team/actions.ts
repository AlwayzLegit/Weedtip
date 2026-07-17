'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sendEmail, teamInviteEmail } from '@/lib/email';
import { canUseFeature } from '@/lib/features';
import { formError, formSuccess, fromZodError, str, type FormState } from '@/lib/forms';
import { INVITABLE_ROLES, type InvitableRole } from '@/lib/member-roles';
import { notifyUser } from '@/lib/notify';
import { requireDispensaryOwner } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  role: z.enum(INVITABLE_ROLES),
});

/** Owner invites a teammate by email. Growth-gated. */
export async function inviteMember(_prev: FormState, fd: FormData): Promise<FormState> {
  const { dispensary, userId } = await requireDispensaryOwner();
  if (!(await canUseFeature(dispensary.id, 'team'))) {
    return formError('Team members are a Growth feature. Upgrade to invite your team.');
  }
  const parsed = inviteSchema.safeParse({
    email: str(fd, 'email') ?? '',
    role: str(fd, 'role') ?? 'associate',
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from('dispensary_members').insert({
    dispensary_id: dispensary.id,
    email: parsed.data.email,
    role: parsed.data.role,
    status: 'pending',
    invited_by: userId,
  });
  if (error) {
    return formError(error.code === '23505' ? 'That email is already invited.' : error.message);
  }

  const m = teamInviteEmail(dispensary.name, parsed.data.role, siteUrl());
  await sendEmail({ to: parsed.data.email, subject: m.subject, html: m.html });

  revalidatePath('/dashboard/team');
  return formSuccess(`Invite sent to ${parsed.data.email}.`);
}

/** Owner changes a member's role. */
export async function setMemberRole(memberId: string, role: InvitableRole): Promise<void> {
  if (!INVITABLE_ROLES.includes(role)) return;
  const { dispensary } = await requireDispensaryOwner();
  const supabase = await createClient();
  await supabase
    .from('dispensary_members')
    .update({ role })
    .eq('id', memberId)
    .eq('dispensary_id', dispensary.id);
  revalidatePath('/dashboard/team');
}

/** Owner removes a member (or revokes a pending invite). */
export async function removeMember(memberId: string): Promise<void> {
  const { dispensary } = await requireDispensaryOwner();
  const supabase = await createClient();
  await supabase
    .from('dispensary_members')
    .delete()
    .eq('id', memberId)
    .eq('dispensary_id', dispensary.id);
  revalidatePath('/dashboard/team');
}

/** Invitee accepts an invite addressed to their email (SECURITY DEFINER RPC). */
export async function acceptInvite(memberId: string): Promise<void> {
  const supabase = await createClient();
  const { data: ok } = await supabase.rpc('accept_dispensary_invite', { p_member_id: memberId });
  if (ok) {
    // Notify whoever sent the invite that it was accepted.
    const { data: member } = await supabase
      .from('dispensary_members')
      .select('invited_by, dispensary:dispensaries(name)')
      .eq('id', memberId)
      .maybeSingle();
    const shop = member?.dispensary as { name: string } | null;
    if (member?.invited_by && shop) {
      await notifyUser(member.invited_by, {
        type: 'team_accepted',
        title: 'Team invite accepted',
        body: `A teammate accepted your invite to ${shop.name}.`,
        href: '/dashboard/team',
      });
    }
    redirect('/dashboard');
  }
  redirect('/invites?error=1');
}
