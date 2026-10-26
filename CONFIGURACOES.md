# Áurea 1.2 — Configurações, pessoas e Google Agenda

## Atualizar o projeto
1. No Supabase, execute **supabase/settings.sql** inteiro. Quem está começando executa schema.sql, push.sql e settings.sql, nessa ordem.
2. Atualize os arquivos no mesmo repositório GitHub; mantenha suas variáveis atuais no Netlify.
3. Aguarde o novo deploy no Netlify. Reabra o aplicativo.

O SQL novo cria perfis e funções de administração. Não apaga lançamentos nem altera o Allinha. O arquivo pode ser executado mais de uma vez.

## Uma aba de Configurações
As antigas áreas Família e Notificações estão reunidas em **Configurações**:
- **Meu perfil**: editar seu nome de exibição e entrar em uma casa por código.
- **Pessoas**: administrador adiciona, remove pessoas e altera seus nomes.
- **Google Agenda**: instruções para criar e vincular lembretes.
- **Notificações**: ativar, testar e desativar o push deste aparelho, diariamente às 20h de Brasília.
- **Como usar**: instruções sobre finanças, filtros, usuários, agenda, push e configuração inicial do administrador.

## Adicionar pessoas
O criador da casa é o administrador. Em Configurações → Pessoas, ele gera um código de uso único com validade de 24 horas.
A outra pessoa cria seu próprio login e, antes de cadastrar registros, entra em Configurações → Meu perfil → Entrar em uma casa existente.
O código é compartilhado por vocês; o app não envia convite por e-mail automaticamente.
Gerar um novo código invalida o anterior.

## Remover pessoas
O administrador escolhe Remover da casa e confirma.
A pessoa perde acesso aos registros da casa. Os lançamentos, pagamentos e histórico financeiro permanecem.
Os códigos ainda não utilizados são invalidados; se necessário, gere outro para um novo membro.
Os lembretes do Áurea da pessoa removida são cancelados.
A conta de autenticação não é apagada, para não afetar outros aplicativos que compartilhem o projeto Supabase.
Em um próximo acesso ao Áurea, essa pessoa poderá ter uma casa própria vazia; o vínculo antigo não é restaurado.
O administrador não pode remover a si mesmo por este fluxo. A transferência de administração não faz parte desta versão.

## Alterar nomes
Cada pessoa altera o próprio nome em Meu perfil. O administrador também pode editar o nome dos membros em Pessoas.
O nome tem de 1 a 80 caracteres e não muda o e-mail nem a senha.
Os nomes são usados no perfil, na seleção do responsável e nos filtros. Os registros antigos que usavam e-mail continuam compatíveis.
Somente membros da mesma casa podem ser administrados; um usuário comum não altera o nome dos demais.

## Adicionar um lançamento ao Google Agenda
1. Abra Lançamentos ou Planejamento e toque no ícone de agenda do registro.
2. Escolha dia inteiro ou um horário de Brasília e duração.
3. Se quiser, marque Incluir o valor na descrição. Essa opção vem desmarcada.
4. Clique em Abrir formulário no Google Agenda.
5. Confira os dados, a conta Google, a agenda de destino e os lembretes. Salve no Google.
6. Para reabrir depois, copie o endereço do evento salvo e guarde no campo Vínculo do Áurea.

O Áurea não acessa nem lê sua agenda. Não há sincronização automática nem confirmação de que você salvou no Google.
Somente a ocorrência selecionada é preparada. Alterações e exclusões posteriores são manuais nos dois sistemas.
O vínculo é guardado por ocorrência e pode ser apagado sem excluir o lançamento ou o evento no Google.
O endereço salvo precisa ser de https://calendar.google.com/calendar/.
Guardar o endereço não concede acesso à agenda para os demais membros; o compartilhamento é feito no próprio Google.

## Testes realizados
- Criação de eventos de dia inteiro, virada de mês/ano, horário de Brasília e inclusão opcional do valor.
- Rejeição de links inseguros ou de domínios diferentes do Google Agenda.
- Alteração do próprio nome, renomeação de membro pelo administrador e bloqueio de alterações por terceiros.
- Remoção de acesso preservando registros, invalidação de convites e cancelamento de assinaturas push.
- Proteção entre casas, recorrências e regras do push já existentes.

O funcionamento real nas suas contas depende de executar a migração SQL e publicar o pacote. A criação e edição do evento no Google são sempre confirmadas por você na tela do Google Agenda.

Referência oficial do formulário de evento por link:
https://developers.google.com/workspace/calendar/api/concepts/inviting-attendees-to-events?hl=pt-br