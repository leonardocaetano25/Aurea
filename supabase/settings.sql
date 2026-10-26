-- Áurea 1.2: perfis, diretório da casa e gestão de pessoas.
-- Execute após schema.sql. Pode repetir sem perder dados.
begin;
create table if not exists public.aurea_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(trim(display_name)) between 1 and 80),
 updated_at timestamptz not null default now()
);
alter table public.aurea_profiles enable row level security;
revoke all on public.aurea_profiles from anon,authenticated;
grant select on public.aurea_profiles to authenticated;
drop policy if exists aurea_profiles_select on public.aurea_profiles;
create policy aurea_profiles_select on public.aurea_profiles for select to authenticated using(user_id=(select auth.uid()) or user_id in (select user_id from public.aurea_members where household_id=(select private.aurea_house_id())));
create or replace function public.aurea_household_people()
returns table(user_id uuid,email text,display_name text,is_owner boolean)
language sql stable security definer set search_path='' as $$
 select m.user_id,u.email::text,coalesce(p.display_name,''),h.owner_id=m.user_id
 from public.aurea_members m join public.aurea_households h on h.id=m.household_id
 join auth.users u on u.id=m.user_id left join public.aurea_profiles p on p.user_id=m.user_id
 where m.household_id=(select private.aurea_house_id()) order by (h.owner_id=m.user_id) desc,m.joined_at,m.user_id;
$$;
create or replace function public.aurea_set_display_name(target_user uuid,new_name text) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hid uuid:=private.aurea_house_id();
begin
 if uid is null or hid is null then raise exception 'Entre na sua casa para continuar.';end if;
 if new_name is null or length(trim(new_name)) not between 1 and 80 then raise exception 'Use um nome de 1 a 80 caracteres.';end if;
 if not exists(select 1 from public.aurea_members where user_id=target_user and household_id=hid) then raise exception 'Pessoa não encontrada nesta casa.';end if;
 if target_user<>uid and not exists(select 1 from public.aurea_households where id=hid and owner_id=uid) then raise exception 'Somente o administrador pode alterar o nome de outra pessoa.';end if;
 insert into public.aurea_profiles(user_id,display_name,updated_at) values(target_user,trim(new_name),now())
 on conflict(user_id) do update set display_name=excluded.display_name,updated_at=excluded.updated_at;
end;$$;
create or replace function public.aurea_remove_person(target_user uuid) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hid uuid:=private.aurea_house_id();
begin
 if uid is null or hid is null then raise exception 'Entre na sua casa para continuar.';end if;
 if not exists(select 1 from public.aurea_households where id=hid and owner_id=uid) then raise exception 'Somente o administrador pode remover pessoas.';end if;
 if target_user=uid then raise exception 'O administrador não pode remover a própria conta por este fluxo.';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_user::text,0));
 perform 1 from public.aurea_households where id=hid for update;
 if not exists(select 1 from public.aurea_members where user_id=target_user and household_id=hid) then raise exception 'Pessoa não encontrada nesta casa.';end if;
 delete from public.aurea_members where user_id=target_user and household_id=hid;
 -- Invalida códigos anteriores para que não sejam usados para retornar após a remoção.
 delete from public.aurea_invites where household_id=hid;
 -- Não apaga a conta de autenticação nem dados de outros aplicativos.
 -- Cancela os lembretes do Áurea da pessoa removida, se o módulo push já estiver instalado.
 if to_regclass('public.aurea_push_subscriptions') is not null then
 execute 'delete from public.aurea_push_subscriptions where user_id=$1' using target_user;
 end if;
end;$$;
revoke all on function public.aurea_household_people(),public.aurea_set_display_name(uuid,text),public.aurea_remove_person(uuid) from public,anon;
grant execute on function public.aurea_household_people(),public.aurea_set_display_name(uuid,text),public.aurea_remove_person(uuid) to authenticated;
commit;