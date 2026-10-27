# Áurea 1.3 — API e GPT pessoal

A API está preparada no pacote. Ela só funciona depois de executar a migração e publicar o código no seu Netlify. Não liga automaticamente esta conversa ao Áurea.

## 1. Atualizar o Supabase

Faça backup antes da atualização. No SQL Editor do projeto Áurea, execute **supabase/api.sql** inteiro. Ele pressupõe schema.sql e settings.sql já executados. Não execute os arquivos antigos outra vez só para esta atualização.

## 2. Atualizar GitHub e Netlify

Extraia o ZIP e atualize os arquivos do mesmo repositório GitHub usado pelo Netlify, com package.json e netlify.toml na raiz. Inclua as novas pastas/arquivos. Não envie o ZIP, node_modules, dist ou .env ao repositório.

No Netlify, mantenha as variáveis já configuradas. A API usa **SUPABASE_URL** e **SUPABASE_SERVICE_ROLE_KEY**, apenas nas Functions de servidor. Não use prefixo VITE na chave administrativa e nunca cole essa chave no GPT. Não é necessário contratar/usar a API da OpenAI para esta integração de Actions.

Faça novo deploy e aguarde Published. Acesse https://aureafamiliar.netlify.app/aurea-openapi.json e confirme que aparece um JSON com título Áurea familiar. Se seu domínio mudar, altere servers[0].url nesse arquivo e publique novamente.

## 3. Criar sua chave pessoal

Abra Áurea → Configurações → ChatGPT / API. Gere uma chave para o seu GPT. Copie agora: o Áurea guarda somente o hash, não recupera a chave original. Ela expira em 90 dias e pode ser revogada nessa mesma tela.

Cada chave fica vinculada à pessoa E à casa original. Se a pessoa sair ou trocar de casa, a chave deixa de funcionar. A remoção ou mudança de vínculo revoga automaticamente as chaves da casa anterior, mesmo se a pessoa voltar depois.

## 4. Criar um GPT privado

Na conta ChatGPT que tiver o recurso de criar GPTs, abra o editor de GPT e crie um GPT pessoal chamado “Meu Áurea”. A disponibilidade do editor depende da conta/plano e não foi verificada nas contas do casal.

Em Configurar → Actions/Ações, importe o schema pelo endereço https://aureafamiliar.netlify.app/aurea-openapi.json (ou cole o JSON do arquivo). Escolha autenticação **API Key → Bearer**, cole SOMENTE a chave pessoal aur_… gerada no Áurea e salve.

Mantenha o GPT privado, disponível somente para você. Com autenticação API Key, a chave é uma configuração do GPT, não um login de cada visitante. Não compartilhe esse GPT para sua esposa usar a SUA chave. Ela fará o mesmo na própria conta, com a própria chave. Um GPT único compartilhado com login individual exigiria OAuth, que não faz parte desta versão.

Cole as instruções do arquivo INSTRUCOES-GPT.txt no campo de instruções do GPT. Teste consultarCadastros primeiro. Depois teste uma inclusão real que você precise fazer e confira o resultado no Áurea. Revogue imediatamente qualquer chave exposta. Não cole a chave no chat ou em arquivos públicos.

## 5. O que pode incluir

- Receitas e despesas, pagas ou previstas; valor desconhecido somente quando pendente.
- Transferências entre contas existentes.
- Recorrências semanais, quinzenais, mensais e anuais; sem fim, até uma data ou por quantidade de parcelas. O valor é de cada parcela.
- Contas e saldos iniciais; cartões com limite, fechamento e vencimento.
- Compras no cartão: data informada é a compra; vencimento calculado igual à interface e status inicial pendente.
- Dívidas: total atualizado, total já pago, credor, vencimento e condições informadas.
- Metas: valor desejado, prazo e valor já reservado.
- Uma alteração de ocorrência via override, incluindo confirmar pagamento/recebimento, omitir uma ocorrência ou guardar link de evento já salvo. É necessário consultar o registro original e enviar os campos completos. Se já existir override nessa ocorrência, altere pela interface.

Cadastrar dívida não cria suas parcelas automaticamente. Valor reservado da meta não transfere saldo bancário. O GPT deve confirmar separadamente a criação das despesas/transferências necessárias, para evitar duplicação. Não há cálculo automático de juros nem envio/salvamento automático no Google Agenda.

Esta versão inclui todos os tipos de cadastro, mas não oferece exclusão em massa, edição dos cadastros existentes, liquidação automática de fatura, alterações de série inteira ou gestão de usuários pela API. Essas ações continuam disponíveis na interface. Não afirme ao usuário que foram feitas pela API.

## 6. Conferência e limites

A Action de inclusão está marcada x-openai-isConsequential=true; as instruções também exigem mostrar e confirmar o resumo. Isso é uma confirmação na conversa, não uma assinatura de aprovação validada pelo servidor. A chave por si só autoriza as inclusões: proteja-a.

A API valida conta, destino, cartão e responsável da mesma casa. O autor é sempre o dono da chave, mesmo quando o responsável financeiro é outra pessoa. Chaves armazenadas por SHA-256; somente rotas de servidor acessam a RPC de execução. Até 60 chamadas/minuto por chave. Solicitações repetidas com o mesmo request_id e corpo não duplicam o lançamento. Um novo request_id constitui outra operação; não evita duplicação semântica de frases parecidas.

Consultas devolvem registros brutos, 100 por página, com offset. Recorrências não são expandidas e filtros de data se aplicam à data armazenada, não a todas as ocorrências futuras. Não calcule saldos/projeções ignorando overrides e recorrências. A interface do Áurea continua sendo a referência para os totais.

Documentação usada: https://developers.openai.com/api/docs/actions/authentication e https://developers.openai.com/api/docs/actions/production
