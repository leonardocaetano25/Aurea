# Atualização 1.3: API para ChatGPT

Para configurar a integração nova, siga **API-CHATGPT.md**. Execute **supabase/api.sql**, atualize o GitHub e publique no Netlify. As configurações existentes permanecem.

# Áurea — Supabase + GitHub + Netlify

Aplicativo de finanças da família, com visual azul e dourado. Não utiliza login do ChatGPT. Push diário às 20h de Brasília. Para receber no iPhone, o Web Push exige abrir pela tela inicial. Consulte PUSH-20H.md.

## Conteúdo
- `src/`: aplicação React, login e acesso ao Supabase.
- `supabase/schema.sql`: tabelas e regras de acesso da família.
- `supabase/push.sql`: assinaturas e envio diário.
- `supabase/settings.sql`: nomes e administração das pessoas.
- `CONFIGURACOES.md`: instruções da versão 1.2, também disponíveis dentro do app.
- `netlify.toml`: compilação, pasta de publicação e redirecionamento da aplicação.
- `.env.example`: nomes das duas variáveis de configuração.
- `tests/`: recorrências e testes locais de segurança do banco.

## 1. Supabase
1. Crie ou escolha um projeto no Supabase. O SQL usa objetos com prefixo `aurea_` e não altera tabelas do Allinha. Um projeto separado facilita a administração.
2. Em **SQL Editor → New query**, execute `supabase/schema.sql`. Depois execute `supabase/push.sql` e `supabase/settings.sql`, cada arquivo inteiro. Para atualizar uma versão já configurada, execute somente o SQL novo que ainda faltar.
3. Em **Authentication**, mantenha login por e-mail e senha habilitado. Com confirmação de e-mail ativa, cada usuário confirma seu endereço antes de entrar.
4. Copie a **Project URL** e a **Publishable key**. A chave pública legada `anon` também é aceita pela aplicação. Não use `service_role`, `sb_secret_...`, senha do banco ou token administrativo no front-end.
5. Depois de publicar no Netlify, em **Authentication → URL Configuration**, defina **Site URL** como o endereço final do aplicativo e autorize esse mesmo endereço em **Redirect URLs**. A confirmação de cadastro e a recuperação de senha voltam para esse endereço.
6. Configure o serviço de e-mail do Supabase conforme os requisitos de entrega e limites da sua conta.

## 2. GitHub
1. Crie um repositório privado para o Áurea, separado do Allinha.
2. Extraia este ZIP.
3. Envie os arquivos e pastas do projeto para a raiz do repositório. `package.json` e `netlify.toml` devem ficar na raiz, não dentro de uma pasta extra.
4. Inclua `package-lock.json`, `.gitignore` e `.env.example`. Não envie `node_modules`, `dist` ou um arquivo `.env` com dados reais.
5. Confirme o commit.

## 3. Netlify
1. Importe o repositório do GitHub como um novo projeto no Netlify.
2. O `netlify.toml` já define:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node: `22`
3. Nas variáveis de ambiente do projeto, com disponibilidade na etapa de build, cadastre:
   - `VITE_SUPABASE_URL` = Project URL do Supabase.
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = chave pública do Supabase.
4. Publique e aguarde o status de sucesso. Caso cadastre ou altere variáveis após a publicação, faça um novo deploy.
5. Abra o endereço gerado. Se aparecer “Falta conectar seu banco de dados”, revise as variáveis e publique novamente.
6. Atualize as URLs de autenticação no Supabase conforme a etapa 1.

## 4. Primeiro acesso e compartilhamento do casal
1. Você cria sua conta, confirma o e-mail se solicitado e entra.
2. Em **Configurações → Pessoas**, clique em **Adicionar pessoa por código**. O código dura 24 horas, funciona uma vez e o novo código invalida o anterior.
3. Sua esposa cria uma conta própria e entra no mesmo endereço.
4. Antes de cadastrar contas e lançamentos, ela abre **Configurações → Meu perfil**, cola o código e clica em **Vincular minha conta**.
5. Os dois passam a visualizar e editar os mesmos registros. O criador da casa é quem gera convites.
6. Cadastrem saldos de conta com a data correta e lancem os movimentos a partir dessa data. O saldo inicial já precisa considerar os movimentos anteriores.
7. O aplicativo busca atualizações ao voltar para a aba e a cada 30 segundos enquanto estiver visível. Não é necessário manter uma aba aberta no outro aparelho para salvar dados.

## 5. Conferência antes de usar no dia a dia
- Cadastre uma conta e uma despesa de teste, atualize a página e confira a permanência.
- Entre com a conta de sua esposa depois do vínculo e confira o mesmo lançamento.
- Use uma terceira conta, sem vínculo, e confirme que ela não vê os dados da casa.
- Teste recorrência até uma data, sem fim, compra parcelada e edição de uma única ocorrência.
- Confirme recuperação de senha no endereço final do Netlify.
- Depois da conferência, exclua os lançamentos de teste.

## Regras financeiras
- Despesas e receitas previstas não alteram o saldo atual até serem confirmadas.
- Valores a confirmar não são estimados nem somados.
- Transferências movimentam contas sem duplicar receitas ou despesas.
- Compras no cartão são atribuídas ao mês de vencimento calculado pelo fechamento; o valor da compra parcelada é o valor de cada parcela.
- Pagar a fatura confirma as compras vinculadas e não gera outra despesa duplicada.
- Dívidas cadastradas servem para acompanhar o saldo devedor. Seus pagamentos devem ser lançados em despesas para participar das projeções; os dois controles ficam separados.
- Metas são informativas e não descontam automaticamente do saldo bancário.
- O campo responsável identifica quem o gasto representa; a última edição registra o e-mail de quem salvou.

## Dados da versão anterior
Este pacote migra o código para a nova arquitetura. Ele não transfere automaticamente registros que tenham sido cadastrados na versão hospedada no ChatGPT. Mantenha a versão anterior até conferir a migração dos dados. A transferência dos registros existentes deve ser feita depois que o projeto Supabase de destino estiver identificado e configurado.

## Desenvolvimento e validação
Use Node 22. A partir da raiz do projeto:
```sh
npm ci
npm run dev
npm run build
npm test
```
Para desenvolvimento local, copie `.env.example` para `.env` e preencha as duas variáveis públicas. Não há credenciais reais incluídas.

## Próximas atualizações
Atualize o mesmo repositório GitHub. O Netlify recompila e publica automaticamente quando a integração estiver conectada. Alterações futuras no banco devem ter sua própria migração SQL; não substitua o banco nem desative as regras RLS.