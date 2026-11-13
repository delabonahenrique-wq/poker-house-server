# Poker House — lançamento internacional pelo site

## Decisão de produto

A primeira entrega pública será exclusivamente web: um site responsivo que funciona no navegador de computadores, tablets e celulares. Não desenvolver nem distribuir APK nesta fase. O app Android/iOS fica para uma etapa posterior, depois de o site, o motor e a operação estarem estáveis.

## Objetivo internacional

Projetar a plataforma para receber jogadores de diferentes países, sem presumir que todas as modalidades são permitidas em todas as regiões.

### Idiomas e localização
- Idioma inicial: português (Brasil).
- Preparar internacionalização desde o começo para inglês e espanhol; permitir adicionar outros idiomas sem reescrever telas.
- Seletor de idioma visível e preferência salva na conta/navegador.
- Datas, números e horários formatados conforme locale e fuso horário do jogador.
- Não traduzir nomes de ações de poker de forma inconsistente; manter um glossário centralizado.
- Conteúdo de suporte, termos, privacidade e regras com versões por idioma.

### Experiência web
- Site responsivo com navegação e lobby no navegador.
- Ao clicar em “Jogar”, abrir uma rota dedicada de mesa, com sessão preservada e opção clara de voltar ao lobby.
- Mesa otimizada para desktop e celular: botões grandes no touch, cartas e stacks legíveis, layout que respeita área útil e orientação.
- Nada de exigir instalação. O jogador entra pelo endereço web.
- Preparar o frontend para instalação como PWA somente se isso não atrasar o lançamento web; não é requisito inicial.
- Não construir APK nesta fase.

### Contas e operação global
- Cadastro e autenticação com validação segura, recuperação de conta e proteção contra abuso.
- Normalizar e validar e-mail; não exigir número de telefone sem necessidade.
- Horários e limites de sessões tratados em UTC no servidor e exibidos no fuso local.
- Preparar arquitetura para regiões/idiomas, suporte, moderação, bloqueios e regras específicas por país.
- Disponibilidade geográfica configurável no servidor; não confiar apenas no país informado pelo navegador.
- Política de privacidade, termos, cookies quando aplicável, idade mínima e regras de comunidade traduzidos antes da abertura pública.
- Observabilidade: erros, latência, quedas, filas e qualidade de conexão por região, sem expor dados pessoais em logs.

## Escopo funcional da primeira versão web

1. Site público com apresentação clara da Poker House, idiomas e acesso/cadastro.
2. Cadastro, login, recuperação de acesso e perfil básico.
3. Lobby com mesas e filtros.
4. Tela de mesa dedicada e responsiva.
5. Motor Texas Hold'em autoritativo no servidor.
6. Gestão de jogadores: fila, assentos, entrada/saída, reconexão, timeout e prevenção de duplicidade.
7. Rush/Fast Fold somente após o fluxo de mesa tradicional estar estável.
8. Histórico de mãos e suporte básico.
9. Administração mínima para moderar usuários e configurar mesas.
10. Fichas exclusivamente fictícias nesta primeira versão.

## Internacionalização de jogo e matchmaking

- Pools separados por variante, blinds, buy-in fictício e regras de mesa.
- Não misturar jogadores em mesas com regras ou limites diferentes.
- Considerar latência e estabilidade regional no matchmaking, sem prometer adversários do mesmo país.
- A mesa deve mostrar horários localizados e regras de jogo de forma inequívoca.
- O servidor permanece responsável por baralho, cartas privadas, ações, turnos, stacks e resultado.
- Evitar revelar cartas privadas ou informações de mãos anteriores ao trocar de mesa no Rush.

## Limites legais e de segurança

“Internacional” significa arquitetura preparada para usuários de vários países, não autorização automática para operar em todos eles. A primeira versão usa somente fichas virtuais sem valor monetário, sem depósitos, saques, transferências ou prêmios em dinheiro. Antes de habilitar qualquer recurso de dinheiro real, apostas com valor econômico ou prêmio resgatável, exigir análise jurídica, licenças e controles aplicáveis em cada jurisdição. Aplicar bloqueios geográficos quando exigido.

## Plano de entrega — web primeiro

### Etapa 1 — Base do site
- Corrigir e validar a estrutura do frontend web existente.
- Criar página pública, seletor de idioma e fluxo de autenticação.
- Remover da navegação e do escopo qualquer módulo Império/construção de cassino.
- Implementar rotas separadas para lobby e mesa.
- Garantir responsividade real em celular e desktop.

### Etapa 2 — Motor e ciclo de vida do jogador
- Revisar regras e testes do Texas Hold'em.
- Persistir sessões e estados de mesa de forma recuperável.
- Implementar reconexão, timeout, saída voluntária e limpeza de assentos.
- Garantir alocação atômica e integridade de stacks fictícios.

### Etapa 3 — Lobby e matchmaking
- Implementar filas por configuração.
- Evitar dupla alocação e mesas incompatíveis.
- Testar concorrência, desconexão e reconexão.
- Só então liberar Rush/Fast Fold.

### Etapa 4 — Internacionalização e lançamento controlado
- Traduzir interface e conteúdo legal prioritário para inglês e espanhol.
- Testar fuso horário, locale, acessibilidade e conexões de regiões distintas.
- Fazer staging, testes de segurança, carga e revisão legal.
- Abrir beta web por regiões permitidas.

### Etapa 5 — Aplicativo
- Somente depois do site estável, avaliar PWA e APK Android/iOS.
- O app será uma camada de acesso à mesma plataforma web/API; não duplicar o motor de jogo.

## Critérios para chamar o site de beta público

- Cadastro/login e recuperação funcionam.
- Interface principal disponível em português, inglês e espanhol.
- Lobby e mesa funcionam em celular e desktop sem cortes.
- O servidor controla todas as ações e cartas.
- Não existem assentos duplicados, fichas duplicadas ou perda de stacks após reconexão.
- Termos, privacidade, moderação e suporte estão disponíveis.
- Fichas permanecem fictícias e não resgatáveis.
- Regiões não autorizadas podem ser bloqueadas por configuração.
- Deploy web monitorado e rollback disponível.

## Situação atual

Este documento define o escopo web-first e internacional. Não representa um lançamento público concluído. O repositório ainda precisa de implementação, testes, configuração de domínio/HTTPS, operação do banco e revisão de segurança antes de abrir o site ao público.
