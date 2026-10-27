import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
// @ts-ignore JavaScript server module
import {validateRecord,applyCard} from '../server/api-core.mjs';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003';
const base={kind:'entry',description:'Mercado',amount:12.5,date:'2026-01-01',person:a,account:'bank',category:'Alimentação',type:'expense',status:'pending'};
test('API valida todos os tipos e rejeita dados ambíguos ou inválidos',()=>{
 assert.equal(validateRecord(base).kind,'entry');
 for(const kind of ['account','goal','debt','card']){const r={kind,description:'Teste',amount:100,date:'2026-01-01',...(kind==='card'?{closing:25,due:5}:{})};assert.equal(validateRecord(r).kind,kind);}
 for(const r of [{...base,date:'2026-02-30'},{...base,date:'2026-99-99'},{...base,amount:1.001},{...base,amount:'10'},{...base,household_id:'foreign'},{...base,person:''},{...base,type:'transfer',target:'bank'},{...base,frequency:'daily'},{...base,status:'paid',amount:null},{...base,card:'card',type:'income'}])assert.throws(()=>validateRecord(r));
 assert.equal(validateRecord({...base,amount:null}).unknown,true);
 const purchase=applyCard({...base,card:'card',date:'2026-01-26'},{closing:25,due:5});assert.equal(purchase.date,'2026-03-05');assert.equal(purchase.purchaseDate,'2026-01-26');assert.equal(purchase.status,'pending');
});
test('API SQL: autoria, isolamento, idempotência, revogação e saída da casa',async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`);
 for(const name of ['schema','settings','api','api'])await db.exec(readFileSync(new URL('../supabase/'+name+'.sql',import.meta.url),'utf8'));
 await db.query('insert into auth.users values ($1,$2),($3,$4),($5,$6)',[a,'a@test.local',b,'b@test.local',c,'c@test.local']);
 async function as(id:string){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,email:id+'@test.local'})]);await db.exec('set role authenticated');}
 await as(a);const house=(await db.query<any>('select aurea_init_house() h')).rows[0].h;const invite=(await db.query<any>('select aurea_create_invite() c')).rows[0].c;
 await db.query('insert into aurea_records(id,household_id,data) values ($1,$2,$3)',['bank',house,{id:'bank',kind:'account',amount:0}]);
 const hashA='a'.repeat(64),hashB='b'.repeat(64);const keyA=(await db.query<any>('select aurea_create_api_key($1,$2) k',[hashA,'Meu GPT'])).rows[0].k;
 await assert.rejects(db.query('select token_hash from aurea_api_keys'));await assert.rejects(db.query('select aurea_api_call($1,$2,$3)',[hashA,'catalog',{}]));
 await as(b);await db.query('select aurea_join_house($1)',[invite]);const keyB=(await db.query<any>('select aurea_create_api_key($1,$2) k',[hashB,'Outro GPT'])).rows[0].k;assert.equal((await db.query<any>('select id from aurea_api_keys')).rows.length,1);
 await as(c);const other=(await db.query<any>('select aurea_init_house() h')).rows[0].h;await db.query('insert into aurea_records(id,household_id,data) values ($1,$2,$3)',['foreign',other,{id:'foreign',kind:'account'}]);
 async function call(hash:string,op:string,payload:any={}){await db.exec('reset role;set role service_role');return (await db.query<any>('select aurea_api_call($1,$2,$3) result',[hash,op,payload])).rows[0].result;}
 const catalog=await call(hashA,'catalog');assert.equal(catalog.records.length,1);assert.equal(catalog.people.length,2);
 const request={request_id:'10000000-0000-4000-8000-000000000001',record:base};const saved=await call(hashB,'create',request);assert.equal(saved.saved,true);const repeated=await call(hashB,'create',request);assert.equal(repeated.record.id,saved.record.id);
 await assert.rejects(call(hashB,'create',{...request,record:{...base,amount:13}}));
 await assert.rejects(call(hashB,'create',{request_id:'10000000-0000-4000-8000-000000000002',record:{...base,account:'foreign'}}));
 await db.exec('reset role');const author=(await db.query<any>('select created_by,updated_by from aurea_records where id=$1',[saved.record.id])).rows[0];assert.equal(author.created_by,b);assert.equal(author.updated_by,'b@test.local');
 await as(a);await db.query('select aurea_revoke_api_key($1)',[keyB]); // another user cannot revoke
 assert.equal((await call(hashB,'catalog')).user_id,b);
 await as(b);await db.query('select aurea_revoke_api_key($1)',[keyB]);await assert.rejects(call(hashB,'catalog'));
 // Every record type can be created without exposing records of another house.
 for(const [i,kind] of ['account','card','debt','goal'].entries()){const r=validateRecord({kind,description:kind,amount:100,date:'2026-01-01',...(kind==='card'?{closing:20,due:5}:{})});assert.equal((await call(hashA,'create',{request_id:`20000000-0000-4000-8000-00000000000${i}`,record:r})).saved,true);}
 await db.exec('reset role');await db.query('update aurea_api_keys set requests=60,window_at=now() where id=$1',[keyA]);assert.equal((await call(hashA,'catalog')).status,429);await db.exec('reset role');await db.query("update aurea_api_keys set window_at=now()-interval '2 minutes' where id=$1",[keyA]);assert.equal((await call(hashA,'catalog')).user_id,a);
 await db.exec('reset role');await db.query('delete from aurea_members where user_id=$1',[a]);await assert.rejects(call(hashA,'catalog'));
 await db.exec('reset role');assert.ok((await db.query<any>('select revoked_at from aurea_api_keys where id=$1',[keyA])).rows[0].revoked_at);
 await db.close();
});
