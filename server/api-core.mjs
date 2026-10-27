export const categories=['Moradia','Alimentação','Transporte','Filhas','Saúde','Educação','Lazer','Assinaturas','Dívidas','Salário','Renda extra','Outros'];
export const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
export function date(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='1900-01-01'&&value<='2200-12-31'&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
function invalid(message){throw Object.assign(Error(message),{status:400});}
export function validateRecord(input){
 if(!input||typeof input!=='object'||Array.isArray(input))invalid('Informe record.');
 const common=['kind','description','amount','date','person'];
 const extra={entry:['type','account','target','card','category','status','frequency','end','installments','unknown','paidDate'],account:[],card:['closing','due'],debt:['paid','notes'],goal:['paid'],override:['entry','type','account','target','card','category','status','frequency','end','installments','unknown','paidDate','skip','googleEventUrl']};
 if(!Object.hasOwn(extra,input.kind))invalid('Tipo de registro inválido.');
 if(Object.keys(input).some(k=>![...common,...extra[input.kind]].includes(k)))invalid('Campo desconhecido.');
 const r={...input};
 if(typeof r.description!=='string'||!r.description.trim()||r.description.length>150)invalid('Descrição obrigatória, até 150 caracteres.');r.description=r.description.trim();
 if(!date(r.date))invalid('Data inválida (AAAA-MM-DD).');
 if(r.amount===null&&['entry','override'].includes(r.kind)){if(r.status==='paid')invalid('Informe o valor antes de confirmar pagamento.');r.unknown=true;}
 else if(typeof r.amount!=='number'||!Number.isFinite(r.amount)||Math.abs(r.amount)>1e12||(r.kind!=='account'&&r.amount<=0)||Math.abs(r.amount*100-Math.round(r.amount*100))>0.001)invalid('Valor inválido; use reais com até 2 casas decimais.');
 if(['entry','override'].includes(r.kind)){
  if(!['income','expense','transfer'].includes(r.type))invalid('Tipo deve ser income, expense ou transfer.');
  if(!['pending','paid'].includes(r.status))invalid('Informe status pending ou paid.');
  if(typeof r.account!=='string'||!r.account||typeof r.person!=='string'||!r.person)invalid('Conta e responsável obrigatórios; consulte o catálogo.');
  if(!categories.includes(r.category))invalid('Categoria inválida; consulte o catálogo.');
  r.frequency=r.frequency||'none';if(!['none','weekly','fortnight','monthly','yearly'].includes(r.frequency))invalid('Recorrência inválida.');
  if(r.end&&(!date(r.end)||r.end<r.date))invalid('Fim da recorrência inválido.');
  if(r.installments!==undefined&&r.installments!==''&&(!Number.isInteger(r.installments)||r.installments<1||r.installments>2400))invalid('Quantidade de parcelas inválida.');
  if(r.installments>1&&r.frequency==='none')invalid('Informe a frequência das parcelas.');
  if(r.paidDate&&(!date(r.paidDate)||r.paidDate>today()))invalid('Data de pagamento inválida.');
  if(r.status==='paid'&&r.date>today())invalid('Data futura deve permanecer prevista.');
  if(r.type==='transfer'&&(!r.target||r.target===r.account||r.card))invalid('Transferência exige outra conta e não aceita cartão.');
  if(r.card&&r.type!=='expense')invalid('Cartão somente para despesas.');
  if(r.kind==='override'&&(!r.entry||typeof r.entry!=='string'))invalid('Informe o lançamento original.');
  if(r.skip!==undefined&&typeof r.skip!=='boolean')invalid('skip deve ser booleano.');
  if(r.googleEventUrl&&!(typeof r.googleEventUrl==='string'&&/^https:\/\/calendar\.google\.com\/calendar\//.test(r.googleEventUrl)))invalid('Link do Google Agenda inválido.');
 }
 if(['debt','goal'].includes(r.kind)){r.paid=r.paid??0;if(typeof r.paid!=='number'||!Number.isFinite(r.paid)||r.paid<0||r.paid>r.amount||Math.abs(r.paid*100-Math.round(r.paid*100))>0.001)invalid('Valor já pago/reservado inválido.');}
 if(r.notes!==undefined&&(typeof r.notes!=='string'||r.notes.length>4000))invalid('Observações: máximo 4000 caracteres.');
 if(!['entry','override'].includes(r.kind)&&r.person!==undefined&&(typeof r.person!=='string'||r.person.length>150))invalid('Pessoa/credor inválido.');
 if(r.kind==='card')for(const k of ['closing','due'])if(!Number.isInteger(r[k])||r[k]<1||r[k]>31)invalid('Fechamento e vencimento: dia de 1 a 31.');
 return r;
}
// A data de uma nova despesa no cartão é a COMPRA, como na interface do Áurea.
export function applyCard(record,card){if(!card||record.kind!=='entry')return record;const [y,m,d]=record.date.split('-').map(Number);const month=m-1+(d>Number(card.closing)?1:0)+(Number(card.due)<=Number(card.closing)?1:0);const first=new Date(Date.UTC(y,month,1));const day=Math.min(Number(card.due),new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate());return {...record,purchaseDate:record.date,date:new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),day)).toISOString().slice(0,10),status:'pending'};}
