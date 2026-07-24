import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Globe, RefreshCw } from 'lucide-react';
import { GoogleSyncButton } from '@/components/dashboard/google-sync-button';
import { UpgradeWall } from '@/components/dashboard/upgrade-wall';
import { getOwnerFeature } from '@/lib/features';
import { requireOwnerDispensary } from '@/lib/owner';

export const metadata: Metadata = { title: 'Google sync' };

export default async function GoogleSyncPage() {
  const { dispensary } = await requireOwnerDispensary();
  const entitled = await getOwnerFeature('google_sync');
  if (!entitled) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Google sync</h1>
          <p className="text-muted mt-1 text-sm">
            Pull {dispensary.name}&apos;s hours, phone, and website straight from your Google
            Business Profile.
          </p>
        </div>
        <UpgradeWall
          feature="Google Business sync"
          description="Upgrade to Basic to import your hours, phone, and website from Google — and keep them in sync. Your listing stays free at 0% commission."
        />
      </div>
    );
  }
  const linked = !!dispensary.google_place_id;
  const lastSync = dispensary.last_google_sync
    ? new Date(dispensary.last_google_sync).toLocaleString()
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Google sync</h1>
        <p className="text-muted mt-1 text-sm">
          Keep {dispensary.name}&apos;s hours, phone, and website consistent between Weedtip and
          your Google Business Profile.
        </p>
      </div>

      <div className="rounded-card border-border bg-surface border p-5">
        <div className="flex items-start gap-3">
          {linked ? (
            <CheckCircle2 className="text-primary mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <Globe className="text-muted mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {linked ? 'Linked to Google' : 'Not linked to Google yet'}
            </p>
            <p className="text-muted mt-1 text-sm">
              {linked
                ? 'This listing is matched to its Google Business Profile, so you can pull your live Google details into Weedtip with one click.'
                : 'We haven’t matched this listing to a Google Business Profile. Make sure your Google listing uses the same name and address, or contact support to link it.'}
            </p>
            {lastSync && <p className="text-muted mt-1 text-xs">Last synced {lastSync}</p>}
          </div>
        </div>

        {linked && (
          <div className="mt-4">
            <GoogleSyncButton />
            <p className="text-muted mt-2 text-xs">
              <RefreshCw className="mr-1 inline h-3 w-3" />
              Imports hours, phone, and website from Google and overwrites those fields here.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-card border-border bg-surface border p-5">
        <p className="font-medium">Manage your Google presence</p>
        <p className="text-muted mt-1 text-sm">
          Edit your hours, photos, and posts on Google itself — changes there flow back the next
          time you sync.
        </p>
        <a
          href="https://business.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary mt-3 inline-flex items-center gap-1 text-sm hover:underline"
        >
          Open Google Business Profile <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="rounded-card border-border bg-surface border p-5">
        <p className="font-medium">How Weedtip feeds Google</p>
        <p className="text-muted mt-1 text-sm">
          Your public Weedtip page publishes structured data (schema.org Store markup with hours,
          address, ratings, and menu links) that Google reads on every crawl — keeping your
          listing here accurate improves how you show up in Search and Maps. Keep your{' '}
          <Link href="/dashboard/listing" className="text-primary hover:underline">
            listing details
          </Link>{' '}
          fresh.
        </p>
      </div>
    </div>
  );
}
