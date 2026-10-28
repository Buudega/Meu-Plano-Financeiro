# Meu Plano Financeiro

App estático para registrar despesas, planejar contas, metas de poupança e viagens.

## Publicação no GitHub Pages

Publique index.html, manifest.webmanifest, service-worker.js, security.js e a pasta icons/ na raiz do projeto do GitHub Pages.

## Proteção dos dados

Na primeira abertura, crie uma senha mestra com pelo menos 12 caracteres. O app deriva uma chave com PBKDF2/SHA-256 e criptografa os dados localmente com AES-256-GCM. O conteúdo salvo no armazenamento do navegador e os novos backups ficam criptografados. O app bloqueia após cinco minutos sem atividade e permite bloqueio manual.

A senha não é enviada a um servidor e não pode ser recuperada. Se esquecê-la, não será possível abrir os dados nem o backup criptografado. Guarde-a em um gerenciador de senhas confiável. Backups antigos sem criptografia ainda podem ser importados; serão criptografados ao serem salvos.

A proteção vale para dados armazenados e backups. Ela não protege contra um aparelho comprometido nem contra código malicioso servido pelo site enquanto o app está desbloqueado. Mantenha o repositório e a conta GitHub protegidos, não publique arquivos de backup e prefira um domínio dedicado ao app se hospedar outros projetos no GitHub Pages.
