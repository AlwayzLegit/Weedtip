'use client';

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, ImagePlus, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Label } from '../ui/label';

const MAX_BYTES = 7 * 1024 * 1024;
const MAX_IMAGES = 12;

/**
 * Owner photo-gallery editor: multi-upload (PNG/JPG/WebP ≤7 MB each) to the
 * dispensary-media bucket, drag-to-reorder (with arrow-button fallback), and
 * per-photo delete. The ordered URLs submit as repeated hidden `gallery_urls`
 * fields; the first photo is the storefront lead image.
 */
export function GalleryManager({
  name = 'gallery_urls',
  defaultUrls = [],
}: {
  name?: string;
  defaultUrls?: string[];
}) {
  const [urls, setUrls] = useState<string[]>(defaultUrls);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragIndex = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
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
      const next = [...urls];
      for (const file of files) {
        if (next.length >= MAX_IMAGES) {
          setError(`You can add up to ${MAX_IMAGES} photos.`);
          break;
        }
        if (file.size > MAX_BYTES) {
          setError(`"${file.name}" is over 7 MB and was skipped.`);
          continue;
        }
        const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('dispensary-media')
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) {
          setError(upErr.message);
          continue;
        }
        next.push(supabase.storage.from('dispensary-media').getPublicUrl(path).data.publicUrl);
      }
      setUrls(next);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function remove(i: number) {
    setUrls(urls.filter((_, idx) => idx !== i));
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= urls.length || from === to) return;
    const a = [...urls];
    const [m] = a.splice(from, 1);
    if (m === undefined) return;
    a.splice(to, 0, m);
    setUrls(a);
  }

  return (
    <div>
      <Label>Photo gallery</Label>
      {urls.map((u) => (
        <input key={u} type="hidden" name={name} value={u} />
      ))}
      <p className="text-muted mb-2 text-xs">
        Up to {MAX_IMAGES} photos. Drag to reorder (or use the arrows) — the first is your lead image.
      </p>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div
            key={u}
            draggable
            onDragStart={() => {
              dragIndex.current = i;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              const from = dragIndex.current;
              dragIndex.current = null;
              if (from != null) move(from, i);
            }}
            className="group border-border relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border bg-cover bg-center"
            style={{ backgroundImage: `url(${u})` }}
          >
            <div className="bg-background/70 absolute left-1 top-1 cursor-grab rounded p-0.5">
              <GripVertical className="h-3.5 w-3.5" />
            </div>
            {i === 0 && (
              <span className="bg-primary absolute bottom-1 left-1 rounded px-1 text-[10px] font-medium text-white">
                Lead
              </span>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove photo"
              className="bg-background/80 hover:bg-background absolute right-1 top-1 rounded-full p-1"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="absolute inset-x-1 bottom-1 hidden justify-end gap-0.5 group-hover:flex">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label="Move left"
                className="bg-background/80 hover:bg-background rounded p-0.5 disabled:opacity-30"
              >
                <ChevronLeft className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === urls.length - 1}
                aria-label="Move right"
                className="bg-background/80 hover:bg-background rounded p-0.5 disabled:opacity-30"
              >
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
        {urls.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className={cn(
              'border-border text-muted hover:border-border-strong hover:text-foreground flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs',
            )}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            {busy ? 'Uploading…' : 'Add photos'}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={onFiles}
      />
      {error && <p className="text-danger mt-1 text-xs">{error}</p>}
    </div>
  );
}
