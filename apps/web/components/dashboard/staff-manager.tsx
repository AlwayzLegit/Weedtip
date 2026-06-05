'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addStaff, deleteStaff, setStaffActive } from '@/app/actions/pos';
import { DeleteButton } from '@/components/dashboard/delete-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Staff = { id: string; name: string; active: boolean };

export function StaffManager({ staff }: { staff: Staff[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    setError(null);
    start(async () => {
      const res = await addStaff(name, pin);
      if (res.ok) {
        setName('');
        setPin('');
        router.refresh();
      } else {
        setError(res.error ?? 'Could not add staff.');
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <label className="text-sm">
          <span className="text-muted mb-1 block font-medium">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-border bg-background h-10 w-48 rounded-md border px-3"
            placeholder="Budtender name"
          />
        </label>
        <label className="text-sm">
          <span className="text-muted mb-1 block font-medium">PIN (4–6 digits)</span>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            className="border-border bg-background h-10 w-32 rounded-md border px-3 tracking-widest"
            placeholder="••••"
          />
        </label>
        <Button disabled={pending || !name.trim() || pin.length < 4} onClick={add}>
          Add staff
        </Button>
        {error && <p className="text-danger w-full text-sm">{error}</p>}
      </div>

      {staff.length === 0 ? (
        <p className="text-muted text-sm">No staff yet. Add your budtenders above.</p>
      ) : (
        <div className="rounded-card border-border bg-surface divide-border divide-y border">
          {staff.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{s.name}</span>
                {s.active ? <Badge tone="primary">Active</Badge> : <Badge tone="muted">Off</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <form action={setStaffActive.bind(null, s.id, !s.active)}>
                  <Button type="submit" size="sm" variant="outline">
                    {s.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </form>
                <DeleteButton action={deleteStaff.bind(null, s.id)} confirmText="Remove this staff member?" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
