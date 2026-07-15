'use client';

import { FileCheck2, Loader2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from './ui/button';

/**
 * Uploads a claim-verification document (state license / business doc) to the
 * PRIVATE `claim-documents` bucket and writes the storage PATH into a hidden
 * form field. Unlike ImageUpload this never produces a public URL — admins read
 * it later via a short-lived signed URL. Accepts images + PDF.
 */
export function ClaimDocumentUpload({ name }: { name: string }) {
  const [path, setPath] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large (max 10 MB).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be signed in to upload.');
        return;
      }
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      const objectPath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('claim-documents')
        .upload(objectPath, file, { upsert: false, contentType: file.type });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      setPath(objectPath);
      setFileName(file.name);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={path} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="hidden"
          onChange={onFile}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : path ? (
            <FileCheck2 className="text-primary h-4 w-4" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {path ? 'Replace document' : 'Upload license / business doc'}
        </Button>
        {path && (
          <span className="text-muted inline-flex items-center gap-1 text-xs">
            {fileName}
            <button
              type="button"
              onClick={() => {
                setPath('');
                setFileName('');
              }}
              aria-label="Remove document"
              className="hover:text-danger"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>
      {error && <p className="text-danger mt-1 text-xs">{error}</p>}
    </div>
  );
}
