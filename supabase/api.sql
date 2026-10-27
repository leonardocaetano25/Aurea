-- Execute depois de schema.sql e settings.sql. Chaves ficam vinculadas à pessoa E à casa.
begin;
create table if not exists public.aurea_api_keys(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 household_id uuid not null references public.aurea_households(id), token_hash text unique not null check(token_hash ~ '^[a-f0-9]{64}$'),
 label text not null check(length(label) between 1 and 80), created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '90 days', revoked_at timestamptz,
 window_at timestamptz not null default now(), requests integer not null default 0
);
alter table public.aurea_api_keys enable row level security;
revoke all on public.aurea_api_keys from public,anon,authenticated;
grant select(id,user_id,household_id,label,created_at,expires_at,revoked_at) on public.aurea_api_keys to authenticated;
drop policy if exists aurea_keys_own on public.aurea_api_keys;
create policy aurea_keys_own on public.aurea_api_keys for select to authenticated using(user_id=auth.uid());
create or replace function private.aurea_revoke_keys_on_membership() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' or new.household_id is distinct from old.household_id then
 update public.aurea_api_keys set revoked_at=coalesce(revoked_at,now()) where user_id=old.user_id and household_id=old.household_id;
 end if;
 return null;
end;$$;
revoke all on function private.aurea_revoke_keys_on_membership() from public;
drop trigger if exists aurea_revoke_keys_on_membership on public.aurea_members;
create trigger aurea_revoke_keys_on_membership after delete or update of household_id on public.aurea_members for each row execute function private.aurea_revoke_keys_on_membership();
create table if not exists public.aurea_api_requests(
 key_id uuid not null references public.aurea_api_keys(id), request_id uuid not null, payload jsonb not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(key_id,request_id)
);
alter table public.aurea_api_requests enable row level security;
revoke all on public.aurea_api_requests from public,anon,authenticated;
create or replace function public.aurea_create_api_key(key_hash text,key_label text) returns uuid
language plpgsql security definer set search_path='' as $$
declare hid uuid; kid uuid;
begin
 if auth.uid() is null then raise exception 'Entre novamente.';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select household_id into hid from public.aurea_members where user_id=auth.uid();
 if hid is null then raise exception 'Vincule sua conta a uma casa primeiro.';end if;
 if (select count(*) from public.aurea_api_keys where user_id=auth.uid() and revoked_at is null and expires_at>now())>=5 then raise exception 'Revogue uma chave antes de criar outra (máximo 5).';end if;
 insert into public.aurea_api_keys(user_id,household_id,token_hash,label) values(auth.uid(),hid,key_hash,trim(key_label)) returning id into kid;
 return kid;
end;$$;
create or replace function public.aurea_revoke_api_key(key_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.aurea_api_keys set revoked_at=now() where id=key_id and user_id=auth.uid();
end;$$;
revoke all on function public.aurea_create_api_key(text,text), public.aurea_revoke_api_key(uuid) from public;
grant execute on function public.aurea_create_api_key(text,text), public.aurea_revoke_api_key(uuid) to authenticated;
-- Apenas a Function de servidor pode executar. Não aceita user_id/casa vindos do GPT.
create or replace function public.aurea_api_call(key_hash text,operation text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare k public.aurea_api_keys%rowtype; result jsonb; previous public.aurea_api_requests%rowtype;
 r jsonb; rid text; req uuid; mail text;
begin
 select * into k from public.aurea_api_keys where token_hash=key_hash and revoked_at is null and expires_at>now() for update;
 if not found then raise exception using message='Acesso inválido ou expirado.',errcode='PT401';end if;
 if not exists(select 1 from public.aurea_members where user_id=k.user_id and household_id=k.household_id) then raise exception using message='Vínculo da casa alterado. Gere outra chave.',errcode='PT401';end if;
 if k.window_at<now()-interval '1 minute' then k.requests:=0;k.window_at:=now();end if;
 if k.requests>=60 then return jsonb_build_object('error','Limite de 60 solicitações por minuto.','status',429);end if;
 update public.aurea_api_keys set requests=k.requests+1,window_at=k.window_at where id=k.id;
 if operation='catalog' then
 select jsonb_build_object('today',to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD'),'user_id',k.user_id,
 'records',coalesce((select jsonb_agg(data) from (select data from public.aurea_records where household_id=k.household_id and data->>'kind' in ('account','card','goal','debt') order by created_at limit 500) s),'[]'::jsonb),
 'people',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(p.display_name,''))) from public.aurea_members m left join public.aurea_profiles p on p.user_id=m.user_id where m.household_id=k.household_id),'[]'::jsonb)) into result;
 return result;
 elsif operation='list' then
 return jsonb_build_object('records',coalesce((select jsonb_agg(data) from (select data from public.aurea_records where household_id=k.household_id and (not(payload ? 'kind') or data->>'kind'=payload->>'kind') and (not(payload ? 'from') or data->>'date'>=payload->>'from') and (not(payload ? 'to') or data->>'date'<=payload->>'to') order by created_at,id limit 100 offset coalesce((payload->>'offset')::integer,0)) s),'[]'::jsonb),'page_size',100);
 elsif operation<>'create' then raise exception 'Operação inválida.';end if;
 req:=(payload->>'request_id')::uuid;
 if req is null then raise exception 'request_id obrigatório.';end if;
 select * into previous from public.aurea_api_requests where key_id=k.id and request_id=req;
 if found then
 if previous.payload<>payload then raise exception using message='request_id reutilizado com dados diferentes.',errcode='PT409';end if;
 return previous.result;
 end if;
 r:=payload->'record';
 if r->>'kind' not in ('entry','account','card','debt','goal','override') or r->>'description' is null or length(r->>'description') not between 1 and 150 then raise exception 'Registro inválido.';end if;
 -- Referências sempre verificadas na casa atual; nenhuma chave pode cruzar casas.
 if r->>'kind' in ('entry','override') then
 if not exists(select 1 from public.aurea_records where household_id=k.household_id and id=r->>'account' and data->>'kind'='account') then raise exception 'Conta não encontrada nesta casa.';end if;
 if r->>'type'='transfer' and (r->>'target'=r->>'account' or not exists(select 1 from public.aurea_records where household_id=k.household_id and id=r->>'target' and data->>'kind'='account')) then raise exception 'Conta de destino inválida.';end if;
 if coalesce(r->>'card','')<>'' and not exists(select 1 from public.aurea_records where household_id=k.household_id and id=r->>'card' and data->>'kind'='card') then raise exception 'Cartão não encontrado.';end if;
 if not exists(select 1 from public.aurea_members where household_id=k.household_id and user_id::text=r->>'person') then raise exception 'Responsável não encontrado.';end if;
 select display_name into mail from public.aurea_profiles where user_id::text=r->>'person';
 r:=r||jsonb_build_object('personName',coalesce(mail,''));
 end if;
 if r->>'kind'='override' then
 if not exists(select 1 from public.aurea_records where id=r->>'entry' and household_id=k.household_id and data->>'kind'='entry') then raise exception 'Lançamento original não encontrado.';end if;
 if exists(select 1 from public.aurea_records where household_id=k.household_id and data->>'kind'='override' and data->>'entry'=r->>'entry' and data->>'date'=r->>'date') then raise exception using message='Esta ocorrência já tem uma alteração. Edite pelo Áurea.',errcode='PT409';end if;
 end if;
 rid:=gen_random_uuid()::text;
 select email into mail from auth.users where id=k.user_id;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',k.user_id,'email',mail,'role','authenticated')::text,true);
 r:=r||jsonb_build_object('id',rid,'source','chatgpt','apiKeyId',k.id);
 insert into public.aurea_records(id,household_id,data) values(rid,k.household_id,r) returning data into r;
 result:=jsonb_build_object('saved',true,'record',r);
 insert into public.aurea_api_requests(key_id,request_id,payload,result) values(k.id,req,payload,result);
 return result;
end;$$;
revoke all on function public.aurea_api_call(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.aurea_api_call(text,text,jsonb) to service_role;
commit;
