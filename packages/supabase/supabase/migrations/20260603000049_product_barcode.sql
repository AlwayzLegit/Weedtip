-- Barcode / SKU for POS scanning (keyboard-wedge: a hardware scanner types the
-- code into the register and Enter adds the matching product).
set search_path = public;

alter table public.products add column if not exists barcode text;
create index if not exists products_barcode_idx
  on public.products (dispensary_id, barcode) where barcode is not null;
