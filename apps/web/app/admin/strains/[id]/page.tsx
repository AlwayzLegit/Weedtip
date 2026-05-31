import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StrainForm } from '@/components/admin/strain-form';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit strain · Admin' };

export default async function EditStrainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: strain } = await supabase.from('strains').select('*').eq('id', id).maybeSingle();
  if (!strain) notFound();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Edit strain</h2>
      <StrainForm strain={strain} />
    </div>
  );
}
