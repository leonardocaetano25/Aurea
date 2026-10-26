-- Execute depois de schema.sql. Seguro para repetir.
begin;
create table if not exists public.aurea_push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(length(endpoint)<4096 and endpoint like 'https://%'),
 p256dh text not null check(length(p256dh)=87 and p256dh~'^[A-Za-z0-9_-]+$'),
 auth text not null check(length(auth)=22 and auth~'^[A-Za-z0-9_-]+$'),
 enabled boolean not null default true,
 device_name text not null default 'Meu aparelho' check(length(device_name)<=100),
 updated_at timestamptz not null default now()
);
create index if not exists aurea_push_user_idx on public.aurea_push_subscriptions(user_id);
alter table public.aurea_push_subscriptions enable row level security;
revoke all on public.aurea_push_subscriptions from anon,authenticated;
grant select,insert,update,delete on public.aurea_push_subscriptions to authenticated;
grant all on public.aurea_push_subscriptions to service_role;
drop policy if exists aurea_push_select on public.aurea_push_subscriptions;
create policy aurea_push_select on public.aurea_push_subscriptions for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists aurea_push_insert on public.aurea_push_subscriptions;
create policy aurea_push_insert on public.aurea_push_subscriptions for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists aurea_push_update on public.aurea_push_subscriptions;
create policy aurea_push_update on public.aurea_push_subscriptions for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists aurea_push_delete on public.aurea_push_subscriptions;
create policy aurea_push_delete on public.aurea_push_subscriptions for delete to authenticated using(user_id=(select auth.uid()));
create table if not exists public.aurea_push_deliveries (
 subscription_id uuid not null references public.aurea_push_subscriptions(id) on delete cascade,
 send_date date not null,
 status text not null check(status in ('sending','sent','error')),
 sent_at timestamptz,
 error_code text,
 primary key(subscription_id,send_date)
);
create table if not exists public.aurea_push_test_limits (
 subscription_id uuid primary key references public.aurea_push_subscriptions(id) on delete cascade,
 last_requested_at timestamptz not null
);
alter table public.aurea_push_deliveries enable row level security;
alter table public.aurea_push_test_limits enable row level security;
revoke all on public.aurea_push_deliveries,public.aurea_push_test_limits from anon,authenticated;
grant all on public.aurea_push_deliveries,public.aurea_push_test_limits to service_role;
create or replace function public.aurea_claim_push_test(subscription uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare claimed uuid;
begin
 insert into public.aurea_push_test_limits(subscription_id,last_requested_at) values(subscription,now())
 on conflict(subscription_id) do update set last_requested_at=excluded.last_requested_at
 where public.aurea_push_test_limits.last_requested_at < now()-interval '60 seconds'
 returning subscription_id into claimed;
 return claimed is not null;
end;$$;
revoke all on function public.aurea_claim_push_test(uuid) from public,anon,authenticated;
grant execute on function public.aurea_claim_push_test(uuid) to service_role;
commit;