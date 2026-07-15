'use client';

import { useActionState } from 'react';
import { UserPlus } from 'lucide-react';
import type { Tables } from '@weedtip/supabase/types';
import { inviteMember, removeMember, setMemberRole } from '@/app/dashboard/team/actions';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { SubmitButton } from '../auth/submit-button';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

type Member = Tables<'dispensary_members'>;

/** Owner-facing team roster: invite by email, change role, remove. */
export function TeamManager({ members }: { members: Member[] }) {
  const [state, action] = useActionState(inviteMember, EMPTY_FORM_STATE);

  return (
    <div className="space-y-6">
      <form action={action} className="card space-y-3 p-5">
        <h2 className="flex items-center gap-1.5 font-semibold">
          <UserPlus className="text-primary h-4 w-4" /> Invite a teammate
        </h2>
        <div className="flex flex-wrap gap-2">
          <Input
            name="email"
            type="email"
            placeholder="teammate@email.com"
            required
            maxLength={254}
            className="min-w-[200px] flex-1"
          />
          <select
            name="role"
            defaultValue="staff"
            className="border-border bg-surface-2 text-foreground h-11 rounded-lg border px-3.5 text-sm"
            aria-label="Role"
          >
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
          </select>
          <SubmitButton>Send invite</SubmitButton>
        </div>
        {state.status === 'error' && state.message && (
          <p className="text-danger text-sm">{state.message}</p>
        )}
        {state.status === 'success' && <p className="text-primary text-sm">{state.message}</p>}
        <p className="text-muted text-xs">
          Staff manage the menu, deals, and orders. Managers can also run promotions. Only you (the
          owner) control billing and the team.
        </p>
      </form>

      {members.length > 0 ? (
        <div className="rounded-card border-border bg-surface overflow-hidden border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {members.map((m) => (
                <tr key={m.id} className="bg-surface">
                  <td className="px-4 py-3">{m.email}</td>
                  <td className="px-4 py-3 capitalize">{m.role}</td>
                  <td className="px-4 py-3">
                    <Badge tone={m.status === 'active' ? 'primary' : 'muted'}>{m.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <form
                        action={setMemberRole.bind(
                          null,
                          m.id,
                          m.role === 'manager' ? 'staff' : 'manager',
                        )}
                      >
                        <Button type="submit" variant="ghost" size="sm">
                          Make {m.role === 'manager' ? 'staff' : 'manager'}
                        </Button>
                      </form>
                      <DeleteButton
                        action={removeMember.bind(null, m.id)}
                        confirmText={`Remove ${m.email}?`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted text-sm">No teammates yet — invite someone above.</p>
      )}
    </div>
  );
}
