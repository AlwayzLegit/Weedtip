'use client';

import { useActionState } from 'react';
import { RefreshCw } from 'lucide-react';
import { saveMenuSource, syncMenuNow } from '@/app/actions/menu-sync';
import { EMPTY_FORM_STATE } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Input } from '../ui/input';

export interface MenuSourceView {
  provider: string;
  feedUrl: string;
  autoSync: boolean;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  itemsImported: number;
}

/** Connect/update the shop's menu feed and trigger on-demand syncs. */
export function MenuSyncForm({ source }: { source: MenuSourceView | null }) {
  const [saveState, saveAction] = useActionState(saveMenuSource, EMPTY_FORM_STATE);
  const [syncState, syncAction] = useActionState(syncMenuNow, EMPTY_FORM_STATE);

  return (
    <div className="space-y-5">
      <form action={saveAction} className="card space-y-4 p-5">
        <FormMessage state={saveState} />
        <div>
          <label htmlFor="provider" className="mb-1.5 block text-sm font-medium">
            Feed format
          </label>
          <select
            id="provider"
            name="provider"
            defaultValue={source?.provider ?? 'generic_json'}
            className="border-border bg-surface-2 text-foreground h-11 w-full rounded-lg border px-3.5 text-sm"
          >
            <option value="generic_json">JSON feed (array of items)</option>
            <option value="csv_url">Hosted CSV (header row)</option>
            <option value="dutchie" disabled>
              Dutchie — coming soon
            </option>
            <option value="jane" disabled>
              Jane — coming soon
            </option>
          </select>
        </div>
        <div>
          <label htmlFor="feed_url" className="mb-1.5 block text-sm font-medium">
            Feed URL
          </label>
          <Input
            id="feed_url"
            name="feed_url"
            type="url"
            required
            placeholder="https://pos.example.com/exports/menu.json"
            defaultValue={source?.feedUrl ?? ''}
          />
          <p className="text-muted mt-1.5 text-xs">
            Must be https and publicly reachable. Most POS systems can publish a scheduled
            menu export.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="auto_sync"
            defaultChecked={source?.autoSync ?? true}
            className="accent-primary h-4 w-4"
          />
          Refresh automatically every day
        </label>
        <SubmitButton size="sm">{source ? 'Update feed' : 'Connect feed'}</SubmitButton>
      </form>

      {source && (
        <form action={syncAction} className="card space-y-3 p-5">
          <FormMessage state={syncState} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium">
                Status:{' '}
                <span
                  className={
                    source.status === 'ok'
                      ? 'text-primary'
                      : source.status === 'error'
                        ? 'text-danger'
                        : 'text-muted'
                  }
                >
                  {source.status === 'ok'
                    ? 'Synced'
                    : source.status === 'error'
                      ? 'Error'
                      : source.status === 'syncing'
                        ? 'Syncing…'
                        : 'Never synced'}
                </span>
              </p>
              <p className="text-muted mt-0.5 text-xs">
                {source.lastSyncedAt
                  ? `Last sync ${new Date(source.lastSyncedAt).toLocaleString()} · ${source.itemsImported} items`
                  : 'Run your first sync to import the menu.'}
              </p>
              {source.lastError && (
                <p className="text-danger mt-1 text-xs">{source.lastError}</p>
              )}
            </div>
            <SubmitButton size="sm">
              <RefreshCw className="h-4 w-4" /> Sync now
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
