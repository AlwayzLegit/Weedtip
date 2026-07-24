'use client';

import { useActionState } from 'react';
import { updateOwnedBrand } from '@/app/actions/brands';
import { FormMessage } from '@/components/auth/form-message';
import { SubmitButton } from '@/components/auth/submit-button';
import { Field } from '@/components/dashboard/field';
import { ImagePicker } from '@/components/dashboard/image-picker';
import { UpgradeBanner } from '@/components/dashboard/upgrade-wall';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EMPTY_FORM_STATE } from '@/lib/forms';

type Brand = {
  id: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  cover_image_url?: string | null;
};

export function BrandManageForm({
  brand,
  canComplete = true,
}: {
  brand: Brand;
  /** Description + website are a Basic-tier feature; logo is free. */
  canComplete?: boolean;
}) {
  const [state, action] = useActionState(updateOwnedBrand, EMPTY_FORM_STATE);

  return (
    <form action={action} className="space-y-4">
      <FormMessage
        state={{
          error: state.status === 'error' ? state.message : undefined,
          message: state.status === 'success' ? state.message : undefined,
        }}
      />
      <input type="hidden" name="brand_id" value={brand.id} />

      {!canComplete && (
        <UpgradeBanner
          href="/studio"
          message="Your logo is editable for free. Upgrade to Basic to add a description and link your website on your brand page."
        />
      )}

      {canComplete && (
        <Field label="Description" htmlFor={`desc-${brand.id}`}>
          <Textarea
            id={`desc-${brand.id}`}
            name="description"
            rows={3}
            defaultValue={brand.description ?? ''}
          />
        </Field>
      )}
      <ImagePicker
        name="cover_image_url"
        label="Cover banner (free)"
        defaultUrl={brand.cover_image_url}
        hint="Shown across the top of your brand page — PNG/JPG/WebP, wide (~3:1) looks best."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Logo URL" htmlFor={`logo-${brand.id}`}>
          <Input
            id={`logo-${brand.id}`}
            name="logo_url"
            defaultValue={brand.logo_url ?? ''}
            placeholder="https://"
          />
        </Field>
        {canComplete && (
          <Field label="Website" htmlFor={`web-${brand.id}`}>
            <Input
              id={`web-${brand.id}`}
              name="website"
              defaultValue={brand.website ?? ''}
              placeholder="https://"
            />
          </Field>
        )}
      </div>
      <SubmitButton>Save brand</SubmitButton>
    </form>
  );
}
