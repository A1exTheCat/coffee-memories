-- Shared public diary: anyone with the app URL can read and change records.
create table if not exists public.coffee_packs (
  id uuid primary key,
  name text not null,
  country text,
  region text,
  variety text,
  process text,
  price_eur numeric(8, 2),
  shop text,
  rating smallint check (rating between 1 and 5),
  notes text,
  image_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.coffee_recipes (
  id uuid primary key,
  coffee_pack_id uuid not null references public.coffee_packs(id) on delete cascade,
  temperature_c smallint not null check (temperature_c between 1 and 100),
  grind_step smallint not null check (grind_step between 0 and 21),
  note text
);

create index if not exists coffee_packs_created_at_idx on public.coffee_packs (created_at desc);
create index if not exists coffee_recipes_pack_id_idx on public.coffee_recipes (coffee_pack_id);

alter table public.coffee_packs enable row level security;
alter table public.coffee_recipes enable row level security;
grant select, insert, update, delete on public.coffee_packs to anon;
grant select, insert, update, delete on public.coffee_recipes to anon;

create policy "Public can read coffee packs" on public.coffee_packs for select to anon using (true);
create policy "Public can add coffee packs" on public.coffee_packs for insert to anon with check (true);
create policy "Public can edit coffee packs" on public.coffee_packs for update to anon using (true) with check (true);
create policy "Public can delete coffee packs" on public.coffee_packs for delete to anon using (true);

create policy "Public can read coffee recipes" on public.coffee_recipes for select to anon using (true);
create policy "Public can add coffee recipes" on public.coffee_recipes for insert to anon with check (true);
create policy "Public can edit coffee recipes" on public.coffee_recipes for update to anon using (true) with check (true);
create policy "Public can delete coffee recipes" on public.coffee_recipes for delete to anon using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coffee-photos', 'coffee-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = true, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

create policy "Public can view coffee photos" on storage.objects for select to anon using (bucket_id = 'coffee-photos');
create policy "Public can upload coffee photos" on storage.objects for insert to anon with check (bucket_id = 'coffee-photos');
create policy "Public can replace coffee photos" on storage.objects for update to anon using (bucket_id = 'coffee-photos') with check (bucket_id = 'coffee-photos');
create policy "Public can delete coffee photos" on storage.objects for delete to anon using (bucket_id = 'coffee-photos');
