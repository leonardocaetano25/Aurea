export const DAILY_SCHEDULE='0 23 * * *';
export const PROSPERITY_MESSAGES=[
 'Prosperidade se constrói com pequenas escolhas conscientes, todos os dias.',
 'Cuidar do dinheiro hoje abre espaço para os sonhos de amanhã.',
 'Cada conta organizada é um passo rumo a uma vida com mais tranquilidade.',
 'Seu futuro floresce com o cuidado que você dedica ao presente.',
 'A abundância também está na paz de saber para onde seu dinheiro vai.',
 'Consistência transforma pequenos passos em grandes conquistas.',
 'Planejar em família é construir, juntos, um futuro de possibilidades.',
 'Reconheça seu progresso: cada decisão consciente faz diferença.',
 'Organizar o presente é cultivar liberdade para o futuro.',
 'Prosperar começa em casa, com clareza, cuidado e constância.',
 'Um pouco de atenção hoje pode trazer mais leveza para amanhã.',
 'Seus sonhos merecem um plano. Continue cuidando deles.'
];
export function localDate(date=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(date);}
export function dailyMessage(date=new Date()){const day=localDate(date);const index=Math.floor(Date.parse(day+'T12:00:00Z')/86400000)%PROSPERITY_MESSAGES.length;return {title:'Áurea · Seu cuidado de hoje',body:'Você está com o Áurea atualizado?\n'+PROSPERITY_MESSAGES[index],tag:'aurea-daily-'+day,url:'/',date:day};}
export function isAllowedPushEndpoint(endpoint){try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&endpoint.length<4096&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'));}catch{return false;}}
export function validSubscription(s){return !!s&&isAllowedPushEndpoint(s.endpoint)&&/^[A-Za-z0-9_-]{87}$/.test(s.keys?.p256dh||'')&&/^[A-Za-z0-9_-]{22}$/.test(s.keys?.auth||'');}
export function isExpiredPush(error){return [404,410].includes(error?.statusCode);}