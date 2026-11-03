# Poker House — MVP técnico (fichas fictícias)

Projeto em desenvolvimento: React/Vite + Express + Socket.IO + Prisma/PostgreSQL + Capacitor Android.

## Incluído nesta versão
- Cadastro e login com hash de senha (bcrypt) e token JWT.
- Carteira individual de fichas fictícias e histórico.
- Recompensa diária com controle por data.
- Lobby de mesas e torneios carregados do banco.
- Débito de fichas fictícias ao entrar em mesa e se inscrever em torneio.
- Canal Socket.IO autenticado e salas de mesa (sinalização de presença).
- Verificação de papel ADMIN, listagem/suspensão de usuários, criação de mesas, torneios e itens cosméticos.
- Catálogo persistente, compra de itens com fichas fictícias e inventário persistente.
- Dados iniciais para mesas, torneio e loja via script seed.
- Estrutura Capacitor para preparar o app Android.

## Ainda não é um produto comercial pronto
O motor completo de Texas Hold'em (baralho, blinds, turnos, apostas, showdown, side pots, reconexão e prevenção de trapaça), loja persistente com inventário, painel de administração para criar/editar itens e torneios, testes automatizados, auditoria de segurança, políticas/termos, moderação e implantação ainda precisam ser concluídos e testados. O Socket.IO atual sinaliza conexão/presença, não executa uma partida completa.

## Regras da economia
Fichas e itens são exclusivamente virtuais, sem valor monetário, sem saque, sem conversão, sem transferência entre usuários e sem promessa de prêmio em dinheiro. Não adicionar depósitos, saques ou apostas com dinheiro real sem análise jurídica e de conformidade independente.

## Requisitos
Node.js 20+, npm e PostgreSQL.

## Rodar localmente
1. Instale Node.js 20 LTS.
2. Copie `.env.example` para `.env` na raiz e configure `DATABASE_URL` e `JWT_SECRET`.
3. No terminal, na pasta raiz:
   `npm install`
   `npm run db:generate`
   `npm run db:push
   npm run db:seed`
4. Inicie:
   `npm run dev`
5. Abra `http://localhost:5173`. API: `http://localhost:3001/health`.

## Criar o primeiro administrador
Por segurança, cadastre a conta normalmente e altere o campo `role` para `ADMIN` diretamente no PostgreSQL usando um usuário administrador do banco. Nunca exponha credenciais do banco no navegador.

## Android
Depois que o site estiver compilando e testado:
`npm run build --workspace @poker-house/web`
`cd apps/web`
`npx cap add android`
`npx cap sync android`
`npx cap open android`
No Android Studio, gere um APK de teste. Para distribuição, configure assinatura e revise permissões, privacidade e segurança.

## Deploy
O arquivo `render.yaml` é uma referência de configuração, mas ainda é necessário criar banco PostgreSQL, configurar variáveis, domínio e origem CORS, fazer deploy e executar testes pós-deploy.

## Limitações que permanecem
A partida Texas Hold'em completa ainda não foi implementada: a conexão Socket.IO atual só autentica e sinaliza presença na sala. Não existe ainda distribuição de cartas, validação de ações, turnos, apostas, avaliação de mãos ou liquidação de pote. O frontend também ainda precisa de telas administrativas para operar os endpoints criados. Não publique como serviço final antes de completar esses itens e fazer revisão de segurança e testes.

## Checklist antes de chamar de versão pronta
- [x] Cadastro/login com senha hasheada.
- [x] Saldo fictício persistido e histórico.
- [x] Recompensa diária (controle básico por data).
- [x] Mesas/torneios persistidos e endpoints de inscrição.
- [x] Loja e inventário persistentes.
- [x] Endpoints administrativos protegidos por papel ADMIN.
- [ ] Motor Texas Hold'em completo e testado (cartas, turnos, apostas, avaliação, pote e reconexão).
- [ ] Interface de mesa para jogar e interface administrativa para operar o painel.
- [ ] Testes automatizados, rate limiting, logs/auditoria e revisão de segurança.
- [ ] PostgreSQL hospedado, deploy, domínio, HTTPS e testes de carga.
- [ ] APK compilado, assinado e testado em aparelho Android.

**Importante:** a lista marcada como concluída representa código incluído, não validação em produção. A instalação de dependências/build não foi confirmada nesta sessão. Não usar para dinheiro real nem anunciar como plataforma de poker pronta.

## Motor Texas Hold'em (primeira implementação)
Foi incluído `apps/api/src/poker/engine.ts`, com baralho embaralhado no servidor, cartas privadas, blinds, rodadas, ações básicas, avaliação de mãos e divisão de side pots. O Socket.IO agora mantém mesas em memória e aceita `table:join`, `table:action` e `table:request-state`.

**Ainda não é produção:** mesas ficam em memória (reiniciar servidor encerra mãos), integração de fichas com carteira ainda precisa ser transacional, não há reconexão/timeout, interface visual de mesa nem testes automatizados. O motor precisa passar por testes de regras antes de receber jogadores reais. Fichas continuam estritamente fictícias.

**Privacidade das cartas:** os estados públicos da mesa não incluem as cartas dos adversários; as cartas privadas são enviadas individualmente pelo Socket.IO ao dono da mão.
