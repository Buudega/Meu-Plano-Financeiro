# Meu Plano Financeiro

App estático publicado no GitHub Pages. Com Supabase configurado, as duas contas do casal acessam o mesmo espaço e sincronizam os registros entre dispositivos.

## Configuração do Supabase

1. Crie um projeto no Supabase e abra o **SQL Editor**.
2. Cole e execute todo o conteúdo de `supabase-setup.sql`.
3. Em **Project Settings > API**, copie a URL do projeto e a chave publicável (anon).
4. Cole esses dois valores em `supabase-config.js`. Nunca use a chave `service_role` ou qualquer chave secreta no site.
5. Em **Authentication > URL Configuration**, adicione o endereço do seu app do GitHub Pages como URL de redirecionamento.
6. Publique todos os arquivos do projeto no GitHub Pages.
7. Cada pessoa cria sua própria conta no app. Uma escolhe **Criar espaço do casal** e envia o código exibido; a outra escolhe **Entrar com código**.

Se precisar corrigir um código ou trocar de espaço, abra **Compartilhar** e escolha **Corrigir código / trocar espaço**. Ao atualizar o app com essa opção, execute novamente `supabase-setup.sql` no SQL Editor para criar a função de desconexão.

O plano gratuito do Supabase pode pausar projetos sem atividade. Mantenha backups exportados pelo app. Os dados sincronizados são protegidos por políticas RLS para que só membros do espaço do casal possam acessá-los.
