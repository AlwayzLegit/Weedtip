'use client';

import { useActionState } from 'react';
import { adminBulkSeedMenu, EMPTY_FORM_STATE } from './actions';
import { FormMessage } from '@/components/auth/form-message';
import { SubmitButton } from '@/components/auth/submit-button';
import { Textarea } from '@/components/ui/textarea';

const SAMPLE = `license,name,category,price,brand,strain_type,thc,cbd,unit,description,in_stock
C10-0000123-LIC,OG Kush 3.5g,flower,45,Cookies,hybrid,22.5,0.1,eighth,Earthy classic hybrid,true
C10-0000123-LIC,Blue Dream Cart 1g,vapes,50,Stiiizy,hybrid,85,0.5,cartridge,Sweet berry vape,true
C10-0000456-LIC,Wyld Gummies 100mg,edibles,25,Wyld,,,,pack,Real-fruit gummies,true`;

/**
 * Bulk menu-seed form: one CSV, many shops. First column is the shop key
 * (license or slug); the rest are the standard product columns.
 */
export function BulkMenuImportForm() {
  const [state, action] = useActionState(adminBulkSeedMenu, EMPTY_FORM_STATE);

  return (
    <form action={action} className="space-y-3">
      <FormMessage
        state={{
          error: state.status === 'error' ? state.message : undefined,
          message: state.status === 'success' ? state.message : undefined,
        }}
      />
      <Textarea name="csv" rows={16} defaultValue={SAMPLE} className="font-mono text-xs" />
      <SubmitButton>Import menus</SubmitButton>
    </form>
  );
}
