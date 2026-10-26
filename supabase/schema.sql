-- Áurea: execute este arquivo inteiro no SQL Editor do Supabase.
-- Objetos próprios com prefixo aurea_; não altera tabelas do Allinha.
begin;
create schema if not exists private;
create table if not exists public.aurea_households (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 name text not null default 'Nossa família',
 created_at timestamptz not null default now()
);
create table if not exists public.aurea_members (
 user_id uuid primary key references auth.users(id),
 household_id uuid not null references public.aurea_households(id),
 joined_at timestamptz not null default now()
);
create index if not exists aurea_members_house_idx on public.aurea_members(household_id);
create table if not exists public.aurea_records (
 id text primary key check(length(id) between 1 and 100),
 household_id uuid not null references public.aurea_households(id),
 data jsonb not null check(jsonb_typeof(data)='object' and data ? 'kind' and data->>'kind' in ('entry','account','override','debt','goal','card') and data ? 'id' and data->>'id'=id),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_by text not null default '',
 updated_at timestamptz not null default now(),
 check(octet_length(data::text)<=40000)
);
create index if not exists aurea_records_house_idx on public.aurea_records(household_id);
create table if not exists public.aurea_invites (
 code text primary key,
 household_id uuid not null references public.aurea_households(id),
 created_by uuid not null references auth.users(id),
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create or replace function private.aurea_house_id() returns uuid
language sql stable security definer set search_path='' as $$
 select household_id from public.aurea_members where user_id=(select auth.uid());
$$;
revoke all on function private.aurea_house_id() from public;
grant usage on schema private to authenticated;
grant execute on function private.aurea_house_id() to authenticated;
alter table public.aurea_households enable row level security;
alter table public.aurea_members enable row level security;
alter table public.aurea_records enable row level security;
alter table public.aurea_invites enable row level security;
revoke all on public.aurea_households,public.aurea_members,public.aurea_records,public.aurea_invites from anon,authenticated;
grant select on public.aurea_households,public.aurea_members to authenticated;
grant select,insert,update,delete on public.aurea_records to authenticated;
drop policy if exists aurea_house_select on public.aurea_households;
create policy aurea_house_select on public.aurea_households for select to authenticated using(id=(select private.aurea_house_id()));
drop policy if exists aurea_members_select on public.aurea_members;
create policy aurea_members_select on public.aurea_members for select to authenticated using(household_id=(select private.aurea_house_id()));
drop policy if exists aurea_records_select on public.aurea_records;
create policy aurea_records_select on public.aurea_records for select to authenticated using(household_id=(select private.aurea_house_id()));
drop policy if exists aurea_records_insert on public.aurea_records;
create policy aurea_records_insert on public.aurea_records for insert to authenticated with check(household_id=(select private.aurea_house_id()));
drop policy if exists aurea_records_update on public.aurea_records;
create policy aurea_records_update on public.aurea_records for update to authenticated using(household_id=(select private.aurea_house_id())) with check(household_id=(select private.aurea_house_id()));
drop policy if exists aurea_records_delete on public.aurea_records;
create policy aurea_records_delete on public.aurea_records for delete to authenticated using(household_id=(select private.aurea_house_id()));
create or replace function private.aurea_stamp_record() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre para salvar.'; end if;
 if tg_op='INSERT' then new.created_by:=auth.uid();new.created_at:=now();
 else new.created_by:=old.created_by;new.created_at:=old.created_at;
 if new.household_id<>old.household_id then raise exception 'Não é permitido mover registros entre casas.';end if;
 end if;
 new.updated_at:=now();new.updated_by:=coalesce(auth.jwt()->>'email','');
 new.data:=new.data||jsonb_build_object('updatedBy',new.updated_by,'updatedAt',new.updated_at);
 return new;
end;$$;
revoke all on function private.aurea_stamp_record() from public;
drop trigger if exists aurea_stamp_record on public.aurea_records;
create trigger aurea_stamp_record before insert or update on public.aurea_records for each row execute function private.aurea_stamp_record();
create or replace function public.aurea_init_house() returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hid uuid;
begin
 if uid is null then raise exception 'Entre para continuar.';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select household_id into hid from public.aurea_members where user_id=uid;
 if hid is null then
 insert into public.aurea_households(owner_id) values(uid) returning id into hid;
 insert into public.aurea_members(user_id,household_id) values(uid,hid);
 end if;
 return hid;
end;$$;
create or replace function public.aurea_create_invite() returns text
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hid uuid; result text;
begin
 if uid is null then raise exception 'Entre para continuar.';end if;
 hid:=public.aurea_init_house();
 if not exists(select 1 from public.aurea_households where id=hid and owner_id=uid) then raise exception 'Somente quem criou esta casa pode gerar convites.';end if;
 delete from public.aurea_invites where household_id=hid;
 result:=replace(gen_random_uuid()::text,'-','');
 insert into public.aurea_invites(code,household_id,created_by,expires_at) values(result,hid,uid,now()+interval '24 hours');
 return result;
end;$$;
create or replace function public.aurea_join_house(invite_code text) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); old_house uuid; inv public.aurea_invites%rowtype;
begin
 if uid is null then raise exception 'Entre para continuar.';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into inv from public.aurea_invites where code=trim(invite_code) and expires_at>now() for update;
 if not found then raise exception 'Código inválido, expirado ou já utilizado.';end if;
 select household_id into old_house from public.aurea_members where user_id=uid for update;
 if old_house=inv.household_id then raise exception 'Você já pertence a esta casa.';end if;
 if old_house is not null then
 perform 1 from public.aurea_households where id=old_house for update;
 if exists(select 1 from public.aurea_records where household_id=old_house) then raise exception 'Sua casa atual tem registros. Exporte e organize os dados antes de trocar de casa.';end if;
 if exists(select 1 from public.aurea_members where household_id=old_house and user_id<>uid) then raise exception 'Sua casa já possui outras pessoas. Não é possível trocar por este fluxo.';end if;
 end if;
 insert into public.aurea_members(user_id,household_id) values(uid,inv.household_id) on conflict(user_id) do update set household_id=excluded.household_id;
 delete from public.aurea_invites where code=inv.code;
 if old_house is not null then
 delete from public.aurea_invites where household_id=old_house;
 delete from public.aurea_households where id=old_house and owner_id=uid;
 end if;
 return inv.household_id;
end;$$;
revoke all on function public.aurea_init_house(),public.aurea_create_invite(),public.aurea_join_house(text) from public;
grant execute on function public.aurea_init_house(),public.aurea_create_invite(),public.aurea_join_house(text) to authenticated;
commit;