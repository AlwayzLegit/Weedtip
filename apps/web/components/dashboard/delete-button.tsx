'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '../ui/button';

/**
 * Delete control bound to a server action. `action` is a pre-bound Server Action
 * (e.g. deleteProduct.bind(null, id)). Confirms before submitting.
 */
export function DeleteButton({
  action,
  label = 'Delete',
  confirmText = 'Delete this item? This cannot be undone.',
}: {
  action: () => Promise<void>;
  label?: string;
  confirmText?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <Button type="submit" variant="ghost" size="sm" className="text-danger hover:bg-danger/10">
        <Trash2 className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only">{label}</span>
      </Button>
    </form>
  );
}
