
import { createHmac, randomUUID, timingSafeEqual, createHash } from 'node:crypto';
const BASE = 'https://aureafamiliar.netlify.app';
const recordSchema = {"type":"object","additionalProperties":false,"required":["kind","description","amount","date"],"properties":{"kind":{"type":"string","enum":["entry","account","card","debt","goal","override"],"description":"entry: receita/despesa/transferência; account: conta; card: cartão; debt: dívida; goal: meta; override: alteração de UMA ocorrência existente sem alteração prévia."},"description":{"type":"string","maxLength":150},"amount":{"type":"number","nullable":true,"description":"Reais, até 2 casas decimais. null somente entrada/ocorrência de valor desconhecido pendente. Conta pode ter saldo negativo."},"date":{"type":"string","format":"date","description":"AAAA-MM-DD. entry com cartão: data da compra; demais: vencimento/data inicial/data da meta/data do saldo. override: vencimento da ocorrência."},"person":{"type":"string","description":"entry/override: UUID de membro do catálogo, obrigatório; demais: nome da pessoa ou credor."},"account":{"type":"string","description":"ID da conta existente, obrigatório em entry/override."},"target":{"type":"string","description":"ID de outra conta, obrigatório para transferência."},"card":{"type":"string","description":"ID do cartão, somente despesas. Nova compra recalcula vencimento e fica pendente."},"category":{"type":"string","enum":["Moradia","Alimentação","Transporte","Filhas","Saúde","Educação","Lazer","Assinaturas","Dívidas","Salário","Renda extra","Outros"]},"frequency":{"type":"string","enum":["none","weekly","fortnight","monthly","yearly"],"description":"Recorrência de entry. Sem end nem installments: sem fim."},"end":{"type":"string","format":"date","description":"Último vencimento permitido, inclusive."},"installments":{"type":"integer","minimum":1,"maximum":2400,"description":"Quantidade total de parcelas; amount é o valor de CADA parcela."},"status":{"type":"string","enum":["paid","pending"],"description":"Obrigatório em entry/override. Não usar paid em data futura."},"type":{"type":"string","enum":["income","expense","transfer"]},"paid":{"type":"number","minimum":0,"description":"debt: total já pago; goal: valor já reservado. Não cria movimentação bancária."},"notes":{"type":"string","maxLength":4000,"description":"Condições da dívida; somente o que o usuário informou."},"closing":{"type":"integer","minimum":1,"maximum":31},"due":{"type":"integer","minimum":1,"maximum":31},"entry":{"type":"string","description":"ID original para override. Enviar os demais campos completos da ocorrência."},"paidDate":{"type":"string","format":"date"},"skip":{"type":"boolean","description":"override: remover somente esta ocorrência da projeção."},"unknown":{"type":"boolean"},"googleEventUrl":{"type":"string","description":"override: URL https://calendar.google.com/calendar/... do evento já salvo manualmente."}}};
function signature(data, secret) { return createHmac('sha256',secret).update(data).digest('base64url'); }
function identity(key) { return createHash('sha256').update(key).digest('hex'); }
const output = data => ({content:[{type:'text',text:JSON.stringify(data)}]});
function validate(record) {
 if (!record || typeof record !== 'object' || Array.isArray(record)) throw Error('Registro inválido.');
 for (const name of recordSchema.required) if (!(name in record)) throw Error('Campo obrigatório: '+name);
 for (const [name,value] of Object.entries(record)) {
  const p=recordSchema.properties[name]; if(!p) throw Error('Campo desconhecido: '+name);
  if(value===null && p.nullable) continue;
  if(p.type==='integer' ? !Number.isInteger(value) : typeof value!==p.type) throw Error('Tipo inválido: '+name);
  if(p.enum && !p.enum.includes(value)) throw Error('Valor inválido: '+name);
  if(p.minimum!==undefined && value<p.minimum || p.maximum!==undefined && value>p.maximum || p.maxLength && value.length>p.maxLength) throw Error('Limite inválido: '+name);
  if(p.format==='date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value)) throw Error('Data inválida: '+name);
 }
 if(['entry','override'].includes(record.kind)) {
  for(const name of ['person','account','status','type']) if(!record[name]) throw Error('Campo obrigatório: '+name);
  if(record.type==='transfer' && (!record.target || record.target===record.account)) throw Error('Informe outra conta de destino.');
 }
}
const tools = [
 {name:'consultar_cadastros',description:'Consulta cadastros e responsáveis da família autenticada.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'listar_registros',description:'Lista registros brutos, 100 por página. Não expande recorrências.',inputSchema:{type:'object',properties:{kind:recordSchema.properties.kind,from:{type:'string',format:'date'},to:{type:'string',format:'date'},offset:{type:'integer',minimum:0,maximum:100000}},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'preparar_inclusao',description:'Valida e devolve os dados completos para confirmação do usuário. NÃO grava. Guarde o token para confirmar ou repetir a mesma operação.',inputSchema:{type:'object',required:['record'],properties:{record:recordSchema},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'confirmar_inclusao',description:'Grava SOMENTE após o usuário confirmar os dados exibidos por preparar_inclusao. Em timeout repita exatamente o mesmo token. Não crie outro rascunho.',inputSchema:{type:'object',required:['confirmation_token'],properties:{confirmation_token:{type:'string'}},additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true}}
];
export function createHandler({fetchImpl=fetch,secret=globalThis.process?.env?.AUREA_MCP_SIGNING_SECRET,now=()=>Date.now()}={}) {
 return async function handler(request) {
  const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  const auth=request.headers.get('authorization')||'';
  if(!/^Bearer [^\s]+$/i.test(auth)) return new Response('Autenticação pessoal obrigatória.',{status:401,headers:{...headers,'WWW-Authenticate':'Bearer realm="Aurea"'}});
  if(request.method!=='POST') return new Response(null,{status:405,headers:{Allow:'POST'}});
  if(!secret || secret.length<32) return reply({error:'Configure AUREA_MCP_SIGNING_SECRET no Netlify (mínimo 32 caracteres aleatórios).'},503);
  let rpc; try { const raw=await request.text(); if(raw.length>65536) return reply({error:'Corpo muito grande.'},413); rpc=JSON.parse(raw); } catch {return reply({jsonrpc:'2.0',id:null,error:{code:-32700,message:'JSON inválido.'}},400);}
  if(!rpc || rpc.jsonrpc!=='2.0' || typeof rpc.method!=='string') return reply({jsonrpc:'2.0',id:rpc?.id??null,error:{code:-32600,message:'Requisição inválida.'}},400);
  if(rpc.id===undefined) return new Response(null,{status:202});
  const result=value=>reply({jsonrpc:'2.0',id:rpc.id,result:value});
  if(rpc.method==='initialize') return result({protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'aurea',version:'0.1.0'}});
  if(rpc.method==='ping') return result({});
  if(rpc.method==='tools/list') return result({tools});
  if(rpc.method!=='tools/call') return reply({jsonrpc:'2.0',id:rpc.id,error:{code:-32601,message:'Método desconhecido.'}});
  async function upstream(path,body) {
   const response=await fetchImpl(BASE+path,{method:body?'POST':'GET',headers:{Authorization:auth,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});
   if(!response.ok) throw Error('API Áurea HTTP '+response.status+'. Em gravação incerta, repita o MESMO token; em 409 confira os registros antes de qualquer nova operação.');
   return response.json();
  }
  try {
   const {name,arguments:args={}}=rpc.params||{};
   if(name==='consultar_cadastros') return result(output(await upstream('/api/aurea/catalog')));
   if(name==='listar_registros') {
    const q=new URLSearchParams();
    for(const [k,v] of Object.entries(args)) {if(!['kind','from','to','offset'].includes(k)) throw Error('Filtro inválido.'); q.set(k,String(v));}
    return result(output(await upstream('/api/aurea/records?'+q)));
   }
   if(name==='preparar_inclusao') {
    validate(args.record);
    const data={request_id:randomUUID(),record:args.record,identity:identity(auth),expires:now()+24*60*60*1000};
    const payload=Buffer.from(JSON.stringify(data)).toString('base64url');
    return result(output({status:'aguardando_confirmacao',request_id:data.request_id,record:data.record,confirmation_token:payload+'.'+signature(payload,secret),instruction:'Exiba todos os dados e peça confirmação antes de chamar confirmar_inclusao. Responsável do registro não substitui autoria da chave autenticada.'}));
   }
   if(name==='confirmar_inclusao') {
    const token=args.confirmation_token;
    if(typeof token!=='string' || token.length>24000) throw Error('Token inválido.');
    const parts=token.split('.'); if(parts.length!==2) throw Error('Token inválido.');
    const [payload,sig]=parts, expected=signature(payload,secret);
    if(Buffer.byteLength(sig)!==Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) throw Error('Token inválido.');
    const data=JSON.parse(Buffer.from(payload,'base64url'));
    if(data.identity!==identity(auth)) throw Error('Rascunho pertence a outra conexão pessoal.');
    if(now()>data.expires) throw Error('Rascunho expirado. Confira os registros antes de preparar outra operação.');
    validate(data.record);
    return result(output(await upstream('/api/aurea/records',{request_id:data.request_id,record:data.record})));
   }
   throw Error('Ferramenta desconhecida.');
  } catch(error) {return result({isError:true,content:[{type:'text',text:error.name==='TimeoutError'?'Tempo esgotado. Resultado incerto: repita o MESMO token; não prepare outro lançamento.':error.message}]});}
 };
}
export default createHandler();
