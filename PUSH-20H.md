# Áurea — Lembrete diário às 20h

## O que foi implementado
- **Configurações → Notificações**: ativação e desativação por aparelho, botão de teste e instruções para iPhone.
- Envio pelo Netlify às **20:00 no fuso America/Sao_Paulo (Brasília)**, inclusive fins de semana.
- Pergunta fixa: **Você está com o Áurea atualizado?**
- Uma das 12 mensagens de prosperidade, alternada conforme a data.
- Mensagens genéricas: nenhum saldo, dívida, valor ou categoria financeira aparece no push.
- Assinaturas isoladas por usuário no Supabase. Sua esposa ativa separadamente no aparelho dela.
- Registro por assinatura e data para evitar duplicação em uma nova execução da mesma rotina.
- Assinaturas expiradas (respostas 404/410) são desativadas.

## 1. Atualize o Supabase
Se ainda não configurou o Áurea, execute primeiro `supabase/schema.sql`.
Depois execute **`supabase/push.sql`** inteiro no SQL Editor.
Quem já configurou o banco precisa executar apenas o novo `push.sql`.
Este SQL não altera as tabelas do Allinha nem os lançamentos do Áurea.

## 2. Gere as chaves
Extraia o ZIP e abra **GERAR-CHAVES-PUSH.html** no computador. Clique em gerar.
O arquivo funciona localmente e gera as chaves no navegador. Não é uma página que você precisa hospedar.
Se preferir terminal, na pasta do projeto execute:
```sh
npm ci
npm run push:keys
```
Gere um único par e mantenha-o nos próximos deploys. Não compartilhe a chave privada nem a envie para o GitHub.

## 3. Configure o Netlify
Mantenha as variáveis públicas que já foram configuradas:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Adicione estas variáveis de **servidor**, disponíveis para Functions:
- `SUPABASE_URL`: a URL do mesmo projeto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: chave administrativa do mesmo projeto, para o envio agendado consultar assinaturas. Cadastre-a diretamente no Netlify; não a envie em conversas nem coloque no repositório.
- `VAPID_PUBLIC_KEY`: chave pública gerada na etapa 2.
- `VAPID_PRIVATE_KEY`: chave privada gerada na etapa 2.
- `VAPID_SUBJECT`: `mailto:seuemail@exemplo.com`, usando seu e-mail real.

As chaves de servidor nunca recebem prefixo `VITE_` e nunca devem estar no código do navegador. O navegador obtém apenas a chave VAPID pública pelo endpoint de configuração.

## 4. Publique
Envie os arquivos atualizados ao mesmo repositório GitHub, preservando `netlify/functions`, `server`, `public` e `supabase`.
O Netlify recompila pelo arquivo `netlify.toml`.
Depois do deploy de produção, confira na área de Functions se **daily-reminder** está agendada.
O cron é `0 23 * * *`: o Netlify usa UTC, por isso 23h UTC equivale às 20h de Brasília.
A função agendada não é exposta para disparo pelo navegador. Deploy Previews não ativam a agenda de produção.
Se alterar as variáveis, faça novo deploy para aplicá-las.

## 5. Ative no aparelho
Entre no Áurea → **Configurações → Notificações** → **Ativar neste aparelho** → permita o recebimento.
Use **Enviar teste** para verificar. Há intervalo mínimo de 60 segundos entre testes por assinatura.
Cada pessoa repete isso no próprio aparelho; não basta ativar só no seu.

### iPhone / iPad
O Web Push no iPhone/iPad exige **iOS/iPadOS 16.4 ou posterior** e o app adicionado à tela inicial:
1. Abra o endereço do Netlify no Safari.
2. Compartilhar → Adicionar à Tela de Início.
3. Abra pelo ícone do Áurea, faça login e ative em Configurações → Notificações.
4. Se a permissão foi bloqueada, revise os ajustes de notificações do aparelho.
Esse passo é requisito da plataforma Apple para push; o acesso comum ao Áurea pelo navegador continua funcionando.

### Android e computador
Use um navegador com suporte a Web Push e permita as notificações do site. A instalação como aplicativo não é exigida para todos esses navegadores.

## Funcionamento e limites
- O envio começa às 20h; a chegada pode variar com o agendador, conexão, modo Foco, permissões e restrições do aparelho. Não há garantia de entrega no segundo exato.
- Não é necessário deixar o app aberto para receber.
- Não é criada uma tarefa de lembrete no ChatGPT: o próprio projeto Netlify faz o envio.
- O service worker trata apenas notificações e não coloca dados financeiros em cache offline.
- A rotina registra uma tentativa por aparelho/data. Se houver falha no provedor, confira os logs no Netlify. Ela não repete automaticamente uma tentativa que já foi registrada, para evitar duplicação.
- Ao desativar neste aparelho, a assinatura é removida do seu cadastro e cancelada no navegador.
- Se usar outra conta no mesmo navegador, desative o push na conta anterior antes de ativar na nova. Em aparelhos diferentes, as assinaturas são independentes.
- Rotacionar as chaves VAPID exige reativar os aparelhos. Não gere outro par em cada atualização.

## Fontes técnicas
- Netlify Scheduled Functions: https://docs.netlify.com/build/functions/scheduled-functions/
- Web Push no iOS/iPadOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Validação da identidade Supabase: https://supabase.com/docs/reference/javascript/auth-getuser

## Validação antes de considerar ativo
O envio real depende das variáveis, do SQL e do deploy nas suas contas. Faça o teste no próprio celular e confira a função agendada no ambiente de produção. Os testes incluídos no pacote validam o código e as regras locais; não comprovam uma entrega real no seu aparelho.