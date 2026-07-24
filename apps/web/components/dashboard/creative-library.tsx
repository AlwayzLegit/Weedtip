'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus } from 'lucide-react';
import { EMPTY_FORM_STATE, type FormState } from '@/lib/forms';
import { FormMessage } from '../auth/form-message';
import { SubmitButton } from '../auth/submit-button';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { MediaImage } from '../media-image';
import { DeleteButton } from './delete-button';
import { ImagePicker } from './image-picker';
import { Field } from './field';

export type AdCreative = {
  id: string;
  name: string;
  image_url: string;
  headline: string | null;
  body: string | null;
};

/**
 * Creative library (spec ⑥): reusable ad creatives — image + headline + body —
 * that placements attach to. Ads render the creative on the public surfaces
 * instead of the raw shop cover / brand logo.
 *
 * Owner-agnostic: the caller passes the save/delete server actions and any
 * hidden fields (e.g. `brand_id`) so the same UI serves shops and brands.
 */
export function CreativeLibrary({
  creatives,
  saveAction,
  deleteAction,
  hiddenFields,
}: {
  creatives: AdCreative[];
  saveAction: (prev: FormState, fd: FormData) => Promise<FormState>;
  deleteAction: (id: string) => Promise<void>;
  hiddenFields?: Record<string, string>;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [state, action] = useActionState(saveAction, EMPTY_FORM_STATE);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Creative library</h2>
          <p className="text-muted text-sm">
            Reusable ad images + copy. Attach one when you reserve a placement — your ad shows the
            creative instead of your storefront photo.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <ImagePlus className="h-4 w-4" /> {showForm ? 'Close' : 'New creative'}
        </Button>
      </div>

      {showForm && (
        <form
          action={action}
          className="border-border bg-surface rounded-card space-y-4 border p-4"
        >
          {Object.entries(hiddenFields ?? {}).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <FormMessage
            state={{
              error: state.status === 'error' ? state.message : undefined,
              message: state.status === 'success' ? state.message : undefined,
            }}
          />
          <Field
            label="Creative name"
            htmlFor="creative-name"
            hint="Internal label, e.g. “Summer sale 16:9”."
          >
            <Input id="creative-name" name="name" maxLength={80} />
          </Field>
          <ImagePicker name="image_url" label="Ad image" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Headline (optional)"
              htmlFor="creative-headline"
              hint="Up to 80 characters."
            >
              <Input id="creative-headline" name="headline" maxLength={80} />
            </Field>
            <Field
              label="Body copy (optional)"
              htmlFor="creative-body"
              hint="Up to 140 characters."
            >
              <Input id="creative-body" name="body" maxLength={140} />
            </Field>
          </div>
          <SubmitButton size="sm">Save creative</SubmitButton>
        </form>
      )}

      {creatives.length === 0 ? (
        !showForm && (
          <p className="border-border text-muted rounded-card border border-dashed p-6 text-center text-sm">
            No creatives yet — placements fall back to your storefront photo.
          </p>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {creatives.map((c) => (
            <div
              key={c.id}
              className="border-border bg-surface rounded-card overflow-hidden border"
            >
              <MediaImage url={c.image_url} alt={c.name} className="h-28" iconClassName="h-8 w-8" />
              <div className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  {c.headline && <p className="text-muted truncate text-xs">{c.headline}</p>}
                </div>
                <DeleteButton
                  action={async () => {
                    await deleteAction(c.id);
                    router.refresh();
                  }}
                  confirmText={`Delete “${c.name}”?`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
