import {createHash} from 'node:crypto';
import {adminClient,json} from '../../server/push-server.mjs';
import {validateRecord,applyCard,categories,date} from '../../server/api-core.mjs';
export default async function handler(request){
 try{
 const url=new URL(request.url);const route=url.searchParams.get('op');const op=route==='records'?(request.method==='POST'?'create':'list'):route;
 if(!['catalog','list','create'].includes(op))return json({error:'Operação desconhecida.'},404);
 if(request.method!==(op==='create'?'POST':'GET'))return json({error:'Método não permitido.'},405);
 const token=request.headers.get('authorization')?.match(/^Bearer (aur_[a-f0-9]{64})$/)?.[1];
 if(!token)return json({error:'Chave pessoal obrigatória.'},401);
 const db=adminClient(),hash=createHash('sha256').update(token).digest('hex');
 async function call(operation,payload={}){const {data,error}=await db.rpc('aurea_api_call',{key_hash:hash,operation,payload});if(error)throw Object.assign(Error(['PT401','PT409','P0001'].includes(error.code)?error.message:'Não foi possível executar a operação.'),{status:error.code==='PT401'?401:error.code==='PT409'?409:error.code==='P0001'?400:503});if(data?.error)throw Object.assign(Error(data.error),{status:data.status||400});return data;}
 let result;
 if(op==='catalog'){result=await call(op);result.categories=categories;}
 if(op==='list'){const payload={};for(const k of ['kind','from','to'])if(url.searchParams.has(k))payload[k]=url.searchParams.get(k);if(payload.kind&&!['entry','account','card','debt','goal','override'].includes(payload.kind))return json({error:'Tipo inválido.'},400);for(const k of ['from','to'])if(payload[k]&&!date(payload[k]))return json({error:'Data inválida.'},400);payload.offset=Number(url.searchParams.get('offset')||0);if(!Number.isInteger(payload.offset)||payload.offset<0||payload.offset>100000)return json({error:'Offset inválido.'},400);result=await call(op,payload);}
 if(op==='create'){
 const raw=await request.text();if(Buffer.byteLength(raw)>12000)return json({error:'Solicitação muito grande.'},413);
 let body;try{body=JSON.parse(raw)}catch{return json({error:'JSON inválido.'},400)}
 if(!body||Object.keys(body).some(k=>!['request_id','record'].includes(k))||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(body.request_id||'')||!/^[a-f0-9-]+$/i.test(body.request_id))return json({error:'request_id UUID obrigatório; reutilize somente ao repetir a mesma solicitação.'},400);
 let record=validateRecord(body.record);
 if(record.card&&record.kind==='entry'){const catalog=await call('catalog');const card=catalog.records.find(r=>r.id===record.card&&r.kind==='card');if(!card)return json({error:'Cartão não encontrado.'},400);record=applyCard(record,card);}
 result=await call(op,{request_id:body.request_id,record});
 }
 return json(result);
 }catch(e){return json({error:e.status?e.message:'Serviço indisponível. Confira as variáveis de servidor e supabase/api.sql.'},e.status||503);}
}
