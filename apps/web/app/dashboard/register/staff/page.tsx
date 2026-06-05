import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StaffManager } from '@/components/dashboard/staff-manager';
import { requireOwnerDispensary } from '@/lib/owner';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'POS staff' };

export default async function RegisterStaffPage() {
  const { dispensary, role } = await requireOwnerDispensary();
  if (!dispensary.pos_addon && role !== 'admin') redirect('/dashboard/register');

  const supabase = await createClient();
  const { data: staff } = await supabase
    .from('pos_staff')
    .select('id,name,active')
    .eq('dispensary_id', dispensary.id)
    .order('name');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">POS staff</h1>
        <p className="text-muted mt-1 text-sm">
          Give each budtender a PIN to sign in at the register; sales are tagged to whoever rang
          them.{' '}
          <Link href="/dashboard/register" className="text-primary hover:underline">
            Back to register
          </Link>
        </p>
      </div>
      <StaffManager staff={staff ?? []} />
    </div>
  );
}
