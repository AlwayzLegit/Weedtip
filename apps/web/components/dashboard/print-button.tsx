'use client';

import { Printer } from 'lucide-react';
import { Button } from '../ui/button';

/** Prints the current page; print CSS on the detail page isolates the receipt. */
export function PrintButton() {
  return (
    <Button size="sm" variant="outline" onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> Print receipt
    </Button>
  );
}
