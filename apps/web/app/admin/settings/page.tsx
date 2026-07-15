import type { Metadata } from 'next';
import { SettingsForm } from '@/components/admin/settings-form';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Platform settings · Admin' };

/**
 * Single source of truth for brand + contact facts. Edits here flow to the
 * footer, structured data, the legal pages, and every email (transactional +
 * Supabase auth) — all read platform_settings.
 */
export default async function AdminSettings() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <p className="eyebrow mb-1">Platform</p>
        <h2 className="text-2xl font-bold">Brand &amp; contact settings</h2>
        <p className="text-muted mt-1 text-sm">
          These values render across the site footer, structured data, legal pages, and every email.
          Change them once here.
        </p>
      </div>
      {settings ? (
        <SettingsForm settings={settings} />
      ) : (
        <p className="text-muted text-sm">Settings row not found. Run the platform_settings migration.</p>
      )}
    </div>
  );
}
