# Poker House Desktop + Fast Fold (Zoom-style) — Plano de implementação

## Objetivo

Evoluir o Poker House para uma experiência desktop de poker, com lobby completo, janela de mesa dedicada, multimesas e um formato de pool fast-fold inspirado no conceito de Zoom Poker. A implementação deve manter identidade visual e código próprios da Poker House; não copiar código, marca, ícones, textos ou assets proprietários da PokerStars.

## Estado atual observado na main

- O código do produto está dentro de `pokerhouse-v6-preparado/`.
- Frontend: React 18 + TypeScript + Vite, em `pokerhouse-v6-preparado/apps/web`.
- Backend: Node.js + Express + Socket.IO, em `pokerhouse-v6-preparado/apps/api`.
- Persistência: PostgreSQL + Prisma.
- O lobby atual lista mesas cash e torneios em cartões.
- A mesa é renderizada dentro da aba Lobby; ainda não há janela/rota dedicada para mesa.
- O motor Texas Hold'em é server-authoritative e suporta 2–9 jogadores, ações fold/check/call/bet/raise/all-in e showdown.
- O motor documenta limitações relevantes: estado de mesa em memória, falta de reconexão/timeout de ação e falta de reconciliação atômica de stacks com carteiras.
- O produto atual declara fichas exclusivamente fictícias, sem saque, transferência ou valor monetário.

## Escopo enxuto: motor, jogadores e mesa

O produto desta etapa não terá Império, construção de cassino, economia paralela ou recursos decorativos. O trabalho se concentra no motor de poker, matchmaking, gestão de assentos/sessões e interface de jogo.

## Experiência desktop proposta

### Estrutura geral do cliente

- Layout responsivo com prioridade equivalente para PC e celular: mesa ampla no desktop e controles grandes/tocáveis no celular.
- Barra superior: marca Poker House, pesquisa, status de conexão, notificações, saldo fictício e perfil.
- Navegação lateral:
  - Lobby
  - Zoom (Fast Fold)
  - Cash Games
  - Torneios
  - Sit & Go
  - Carteira
  - Autoavaliação
  - Academy
  - Perfil / Ajustes
- Área central do lobby com filtros, busca, ordenação e lista/tabela de jogos.
- Remover a seção Império de toda navegação e tela. Não criar moeda secundária, construção de cassino ou marketplace nesta etapa.
- Painel lateral opcional com notícias do clube, eventos e atividade.
- Clique em Jogar abre uma rota/tela dedicada de mesa, separada do lobby, mantendo a sessão ativa ao alternar entre as telas.
- No celular, usar layout adaptável, cartas e stacks legíveis, botões Fold/Check/Call/Bet/Raise/All-in grandes e posicionados para toque.
- No PC, ocupar a área útil com mesa central ampla, assentos bem distribuídos, painel de ações e histórico sem sobreposição.
- Controles da mesa: minimizar, maximizar, tela cheia, sair, histórico de mãos e preferências visuais.
- Multimesas somente depois que uma mesa única estiver estável; não sacrificar legibilidade nem desempenho.
- Identidade Poker House: fundo onyx, feltro verde, dourado e componentes próprios; não reproduzir a skin ou os ícones exclusivos de terceiros.

### Lobby

Tabela de jogos com colunas:
- Jogo / variante
- Limite (small blind / big blind)
- Buy-in mínimo e máximo
- Jogadores / assentos disponíveis
- Tipo: Cash, Zoom, Sit & Go ou Torneio
- Velocidade / início
- Ação: Sentar / Jogar agora

Filtros:
- Texas Hold'em e Omaha (somente quando o motor da variante estiver implementado e testado)
- Limites e buy-in
- Mesas cheias / mesas com vagas
- 6-max / 9-max
- Fichas fictícias
- Busca por nome

### Tela de mesa dedicada

- Mesa oval com feltro Poker House, assentos, avatares, stacks e botão de dealer.
- Cartas comunitárias, pote principal e potes laterais.
- Cartas privadas visíveis apenas ao próprio jogador.
- Indicador de turno e relógio de ação.
- Ações: Fold, Check, Call, Bet, Raise e All-in.
- Slider e atalhos de aposta.
- Histórico de ações e resultado da mão.
- Estados de conexão, reconexão e assento reservado.
- Não confiar em estado enviado pelo cliente: motor e validação das ações permanecem no servidor.

## Modo Poker House Rush (nome provisório para o Fast Fold)

### Experiência do jogador

1. O jogador escolhe Rush no lobby.
2. Seleciona variante, limite, buy-in e número de mesas rápidas.
3. Entra em uma fila/pool de jogadores elegíveis para a mesma configuração.
4. O servidor o posiciona aleatoriamente em uma mesa com jogadores suficientes.
5. Quando usa Fast Fold, a ação FOLD é registrada na mão atual imediatamente, mesmo antes de chegar sua vez quando a regra permitir.
6. O servidor remove o jogador daquela mesa após registrar o fold e o coloca novamente na fila do mesmo pool.
7. Assim que houver uma nova mão/assento disponível, o jogador recebe novas cartas e adversários diferentes.
8. Se o jogador apenas der Call, Check, Bet ou Raise, permanece na mão atual; não há troca automática por pagar. A troca rápida ocorre ao desistir/foldar.

### Regras técnicas e de integridade

- Pool separado por variante, blinds, buy-in e tipo de jogo.
- Fila com matching atômico para impedir dupla alocação do mesmo jogador.
- Fast Fold como evento próprio do servidor; nunca confiar em evento do navegador para creditar/debitar fichas.
- Ao receber Fast Fold: validar sessão, mesa, mão e jogador; marcar fold; publicar estado sem revelar cartas; liberar assento; inserir jogador no pool.
- Distribuir novas cartas somente depois da confirmação de assento em uma nova mão.
- Shuffle criptograficamente seguro no servidor.
- Não reutilizar cartas nem revelar cartas privadas de mãos abandonadas.
- Impedir que o jogador volte à mesma mesa/mão de modo a obter informação indevida.
- Limites de taxa, proteção contra spam de Fast Fold e desconexões.
- Tratamento de jogadores all-in: não oferecer Fast Fold se a ação já não puder abandonar a mão; o jogador permanece até o desfecho.
- Persistir sessões, snapshots e histórico suficiente para recuperação após reinício.
- Gerenciar blinds e posições por pool; evitar exploração de blinds/assentos ao trocar de mesa.
- Telemetria: tempo de fila, mãos por hora, abandono, reconexões, erros e latência.
- Testes concorrentes de fila, duplicidade de assento, desconexão durante fold, all-in, side pots e reinício do servidor.

### Recursos desktop adicionais

- Atalho configurável para Fast Fold (por exemplo, espaço), com confirmação opcional para evitar clique acidental.
- Opção “Fold e assistir” separada: registra fold e mantém a visualização da mão antiga, sem atrasar a entrada na próxima mão se o modo Rush estiver configurado para troca imediata.
- Sons, animações e velocidade ajustáveis.
- Layout de mesa compacto / confortável.
- Preferências persistidas por usuário.

## Histórico e dados de jogo

Manter histórico de mãos e decisões com dados reais do servidor. Qualquer painel de estatísticas será secundário ao funcionamento correto do motor, das sessões e do matchmaking.

## Autoavaliação

Registrar cada decisão e mão com dados reais do servidor:
- posição, cartas próprias, board, ação, tamanho do pote, stacks e resultado.
- estatísticas por posição e tipo de decisão.
- frequência de VPIP/PFR, agressão, folds e showdown, quando os dados necessários estiverem disponíveis.
- evolução por período e revisão de mãos.
- Não inventar “percentual de jogada correta” sem um modelo de avaliação documentado; separar estatísticas observadas de recomendações estratégicas.

## Fases de entrega

### Fase 0 — Segurança e baseline
- Criar testes de regressão para entrada nas mesas já corrigida.
- Confirmar o build atual e manter a branch main intocada.
- Documentar contratos Socket.IO e modelos Prisma.

### Fase 1 — Lobby e tela de mesa responsiva
- Criar shell desktop responsivo.
- Implementar lobby em tabela, filtros e pesquisa.
- Criar rota/tela dedicada de mesa e controles de janela/tela cheia.
- Manter somente as áreas essenciais ao jogo: Lobby, mesas, Rush/Fast Fold, carteira fictícia, histórico e perfil/configurações. Academy e recursos paralelos ficam fora do escopo desta etapa.

### Fase 2 — Motor da mesa e ciclo de jogadores
- Refatorar a mesa para componente dedicado.
- Implementar histórico, relógio de ação, slider de apostas e layouts.
- Garantir que os eventos de entrada/saída e reconexão sejam consistentes.

### Fase 3 — Backend de pool Fast Fold e matchmaking
- Adicionar entidades de pool, fila, sessões e assentos temporários no Prisma.
- Criar serviços server-side de matchmaking e alocação atômica.
- Adicionar eventos Socket.IO específicos para entrar no pool, fast-fold, próximo assento e status de fila.
- Persistir estado e resolver recuperação de sessão.

### Fase 4 — Experiência Rush/Fast Fold
- Criar aba Rush no lobby.
- Adicionar Fast Fold, animações de troca, feedback de fila e histórico de mãos.
- Implementar suporte inicial a uma mesa por jogador; multimesas rápidas depois de estabilizar.

### Fase 5 — Testes de integridade e lançamento
- Testes unitários e integração com jogadores simultâneos.
- Testes de carga e reconexão.
- Auditoria de integridade do motor e da carteira fictícia.
- Validar a mesma mesa responsiva em navegadores desktop e Android; gerar APK somente após testes.
- Deploy de staging; só depois de aprovação, PR para main.

## Critérios de aceite

- O lobby desktop funciona em 1366x768 e 1920x1080 sem cortes.
- Abrir uma mesa cria uma experiência dedicada, com retorno ao lobby sem perder a sessão.
- A correção de entrada do PR #1 continua coberta por testes.
- Em Rush, Fast Fold registra fold no servidor e o jogador recebe nova mão contra novos adversários sem aguardar o fim da mão anterior.
- Call/Check/Bet/Raise mantêm o jogador na mão atual.
- Nunca há cartas privadas de outros jogadores expostas.
- Não há alocação dupla, crédito duplicado ou débito duplicado em testes concorrentes.
- Desconexões e reinícios não corrompem stacks ou sessões.
- A carteira continua usando somente fichas fictícias até uma revisão jurídica e de produto separada.
- Nenhuma alteração é mesclada em main antes de testes e revisão.

## Limitações e dependências atuais

O motor atual é uma primeira versão e o README já registra que o estado é em memória, que stacks ainda não são reconciliados atomicamente com a carteira persistida e que faltam reconexão e timeout de ação. O modo Rush não deve ser lançado antes de resolver essas limitações, porque o Fast Fold depende de realocação confiável e concorrente de jogadores.

## Escopo internacional e web-first
A primeira entrega é somente o site, acessível pelo navegador em computadores e celulares. Preparar internacionalização (português inicial, inglês e espanhol previstos), formatação por locale/fuso horário, suporte e políticas localizadas. Disponibilidade por país será configurável e sujeita a revisão legal; fichas continuam fictícias. O aplicativo instalável fica para uma fase posterior.

## Referência funcional

A documentação pública do Zoom Poker descreve um pool de jogadores, troca de adversários após fold e a opção Fast Fold antes da vez do jogador. Poker House implementará esse conceito com regras e interface próprias.
