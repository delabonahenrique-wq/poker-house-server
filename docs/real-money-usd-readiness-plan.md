# Poker House — preparação para carteira financeira em USD

## Status e princípio de segurança

Esta é uma especificação de arquitetura e preparação técnica. Não autoriza nem ativa operações com dinheiro real. Até aprovação jurídica, contratual, regulatória e operacional, depósitos, apostas com valor econômico, transferências e saques devem permanecer tecnicamente bloqueados.

A primeira entrega continua web-first. O motor, lobby e mesas devem funcionar independentemente do provedor financeiro. A moeda de referência da futura carteira é exclusivamente USD; a interface não oferece saldos em moedas locais.

## Decisões de produto

- Moeda única da carteira: USD.
- Unidade interna: centavos inteiros de USD (integer/BigInt), nunca float para dinheiro.
- Jogadores que pagarem em outra moeda serão convertidos pelo provedor contratado antes do crédito na carteira.
- A Poker House registra e exibe somente o valor liquidado em USD, com cotação, tarifas, moeda de origem e valor original no recibo quando informados pelo provedor.
- Não presumir que um banco comum aceita poker, jogos P2P ou pagamentos relacionados. O parceiro deve aprovar expressamente o modelo, países e fluxo de fundos.
- Fichas de mesa e saldo financeiro são domínios separados. Nunca usar saldo da carteira diretamente como stack.
- Nenhum dinheiro real, prêmio resgatável ou transferência entre usuários na primeira fase de desenvolvimento.

## Arquitetura proposta

1. Poker engine: regras, baralho, turnos, potes, side pots, showdown e resultados; autoridade exclusiva do servidor.
2. Game ledger: registro separado das entradas e saídas de fichas de jogo. Nunca é fonte do saldo financeiro.
3. Financial ledger: livro-razão de dupla entrada, em centavos USD, com lançamentos imutáveis e referências externas.
4. Payment orchestration: adaptador de provedor, webhooks assinados, reconciliação e estados de pagamento.
5. Compliance: KYC/idade, AML/sanções, geolocalização, limites, autoexclusão, revisão e auditoria.
6. Admin/finance operations: conciliação, relatórios, estornos autorizados, disputas e trilha de auditoria.

## Modelo de saldo e dados

Manter contas contábeis distintas por usuário e finalidade:
- customer_available_usd
- customer_reserved_usd
- provider_clearing_usd
- platform_fee_revenue_usd
- refunds_payable_usd
- withdrawals_payable_usd
- chargebacks_reserve_usd

Todo lançamento deve ter débito e crédito balanceados. Saldo exibido é uma projeção derivada do ledger, nunca um campo editável pelo cliente. Reservas para uma mesa são lançamentos atômicos entre disponível e reservado. Liquidação de resultados, taxas, cancelamentos e estornos ocorre por transações consistentes, com referência à mão ou torneio.

Entidades sugeridas:
- WalletAccount: userId, currency=USD, accountType, status.
- LedgerTransaction: id, type, status, idempotencyKey, externalReference, createdAt, metadata minimizada.
- LedgerEntry: transactionId, accountId, direction, amountMinor (inteiro positivo), currency=USD.
- PaymentIntent: provider, providerIntentId, userId, sourceCurrency, sourceAmount, quotedUsdMinor, settledUsdMinor, fxRate, feeMinor, status, timestamps.
- PayoutRequest: provider, destinationToken/reference, amountUsdMinor, status, riskReview, timestamps.
- ComplianceProfile: status de verificação, jurisdição, idade e revisão; manter dados sensíveis no provedor KYC sempre que possível.
- ResponsibleGamingLimit: limites e autoexclusão com histórico de alterações.
- ProviderWebhookEvent: providerEventId único, assinatura validada, payload minimizado, processedAt.
- FinancialAuditEvent: ator, ação, motivo, correlação e timestamp.

Todos os valores monetários carregam currency explícita, embora somente USD seja aceito. Restrições do banco impedem outra moeda no ledger.

## Depósitos futuros — desabilitados até aprovação

1. Cliente autenticado solicita depósito; backend verifica país, compliance, limites e feature flag global/regional.
2. Backend cria PaymentIntent no provedor por adaptador; nunca recebe dados brutos de cartão.
3. Provedor informa meios de pagamento e conversão cambial. A tela mostra valor de origem, cotação, tarifa, valor estimado em USD e validade da cotação.
4. Crédito somente após webhook autenticado e/ou consulta server-to-server que confirme liquidação final.
5. Backend verifica assinatura, evento único, usuário, valor, moeda, estado e referência externa; aplica idempotência.
6. Ledger credita somente o valor efetivamente liquidado em USD, descontando tarifas conforme contrato e política publicada.
7. Recibos e extratos preservam dados de origem e conversão para suporte e auditoria.

Nunca creditar com base em retorno do navegador, comprovante enviado pelo jogador ou estado pendente. Tratar pagamentos atrasados, duplicados, cancelados, expirados, reembolsados e contestados.

## Saques futuros — desabilitados até aprovação

1. Verificar KYC, titularidade, país permitido, origem dos fundos, limites e análise antifraude.
2. Reservar o valor em transação atômica no ledger.
3. Submeter solicitação ao parceiro aprovado.
4. Atualizar para pago somente após confirmação final server-to-server.
5. Em falha ou rejeição, liberar reserva por lançamento compensatório, sem apagar lançamentos anteriores.
6. Exigir revisão reforçada para alterações de titularidade, padrões incomuns e solicitações de alto risco.

Não permitir saque para terceiros nem prometer prazo ou cobertura internacional antes do contrato com o provedor.

## Provedor financeiro e câmbio

A integração deve usar adaptador substituível, com operações equivalentes a createDepositIntent, getDepositStatus, verifyWebhook, createPayout, getPayoutStatus, refund/void e getSettlementReport.

Critérios eliminatórios:
- autorização e capacidade contratual para o modelo específico (poker/P2P/cash games/torneios conforme o produto);
- cobertura explícita dos países pretendidos;
- conversão automática da moeda de origem para USD e cotação/tarifas transparentes;
- liquidação em conta empresarial apropriada e reconciliação;
- suporte a pagamentos, saques, chargebacks, reembolsos e relatórios;
- políticas KYC/AML, sanções, fraude, retenção e proteção de dados;
- API, webhooks assinados e ambiente sandbox;
- aprovação dos fluxos de fundos pela assessoria jurídica.

Não escolher provedor apenas porque aceita USD ou oferece checkout genérico. Não armazenar PAN/CVV nem credenciais financeiras sensíveis nos servidores Poker House.

## Checklist jurídico para o advogado

Obter análise escrita e específica para:
- país de constituição, residência dos operadores e estrutura societária;
- classificação jurídica do poker e de cada modalidade (cash, torneios, rake, P2P e premiação);
- países onde jogadores podem se registrar, jogar, depositar e sacar;
- licenças, autorizações, notificações ou proibições por jurisdição;
- papel da Poker House no fluxo de fundos (operadora, agente, marketplace, prestadora tecnológica ou custodiante);
- custódia/segregação de fundos, insolvência, safeguarding e eventual necessidade de instituição autorizada;
- regras cambiais, pagamentos transfronteiriços, tributação e contabilidade;
- KYC, idade mínima, AML, sanções, comunicações obrigatórias e conservação de registros;
- proteção de dados, transferências internacionais, privacidade e incidentes;
- publicidade, bônus, rake, torneios, jogo responsável e autoexclusão;
- termos de uso, política de saque, tarifas, disputas, chargebacks e reclamações;
- auditoria técnica, certificação do RNG e integridade do jogo, se exigidas.

A assessoria deve entregar matriz por país: permitido, permitido sob licença/condições, proibido ou não avaliado. País não avaliado fica bloqueado por padrão.

## Segurança, fraude e operação

- KYC/idade antes de qualquer movimentação financeira; reverificação baseada em risco.
- Screening de sanções e PEP quando aplicável, monitoramento transacional e processo de investigação.
- Geoblocking no servidor com fontes confiáveis; não confiar no país informado pelo navegador.
- MFA para ações sensíveis, gestão de sessão e proteção contra account takeover.
- Limites configuráveis de depósito, perda, sessão e saque; períodos de espera e autoexclusão conforme a lei.
- Detecção de multi-accounting, conluio, chip dumping, abuso de bônus, bots e padrões anômalos.
- Segregação de funções: suporte não cria crédito manual sem aprovação dupla e motivo auditável.
- Criptografia em trânsito e repouso, gestão de chaves e segredos fora do repositório.
- Logs sem dados pessoais desnecessários; trilha de auditoria e retenção definidas juridicamente.
- Monitoramento, alertas, reconciliação diária, plano de incidentes e backup/restauração testados.

## Feature flags e bloqueios obrigatórios

Todas OFF por padrão:
- REAL_MONEY_ENABLED=false
- DEPOSITS_ENABLED=false
- CASH_GAMES_REAL_MONEY_ENABLED=false
- TOURNAMENT_PRIZES_ENABLED=false
- WITHDRAWALS_ENABLED=false
- P2P_TRANSFERS_ENABLED=false

Ativação exige aprovação verificável por ambiente e jurisdição. O bloqueio existe no backend e no provedor; esconder botões no frontend não basta. Sem país aprovado, negar operação. Desenvolvimento e staging usam exclusivamente sandbox e fundos fictícios.

## Testes de aceitação

- Ledger de dupla entrada sempre balanceado e sem floats.
- Idempotência para requisições, webhooks e callbacks duplicados.
- Concorrência, corrida entre saque e jogo, reservas e rollback.
- Conversão, cotação expirada, tarifas, arredondamento e divergência entre estimado e liquidado.
- Reconciliação entre ledger interno, provedor e extrato bancário.
- Chargeback, reembolso, depósito tardio, webhook fora de ordem e falha parcial.
- Geoblocking, KYC pendente/reprovado, idade e limites.
- Pentest, permissões, dependências e teste de carga.
- Revisão independente do motor, RNG e integridade, quando exigida.
- Continuidade, backup e restauração.
- Parecer jurídico escrito e contrato do provedor antes de qualquer piloto.

## Plano de implementação

1. Auditar motor, schema, autenticação, sessões e infraestrutura atuais.
2. Corrigir e testar motor e ciclo de vida das mesas sem dinheiro real.
3. Construir carteira e ledger em sandbox, sem funding real.
4. Criar adaptador mock e testes de webhooks/idempotência.
5. Integrar KYC/AML/geoblocking em sandbox, minimizando dados sensíveis.
6. Implementar console de reconciliação e auditoria.
7. Obter parecer jurídico, matriz de países, contrato e aprovação do parceiro.
8. Fazer revisão de segurança e piloto somente em jurisdições liberadas.
9. Ativar flags individualmente, com rollback e monitoramento.

## Não fazer

- Não ativar dinheiro real por variável de ambiente isolada ou alteração manual do banco.
- Não permitir depósito, saque, transferência ou prêmio resgatável antes das aprovações.
- Não misturar fichas fictícias com dinheiro ou chamar fichas de USD sem respaldo jurídico e contratual.
- Não manter saldo por atualização direta de campo nem confiar no frontend.
- Não inventar suporte de país, licença, banco ou provedor.
- Não armazenar dados completos de cartão ou credenciais bancárias.
- Não lançar internacionalmente sem matriz jurídica por país.

## Estado atual conhecido

Esta especificação não significa que carteira, pagamentos, compliance ou motor estejam implementados e aprovados. A auditoria do código e os testes de cada etapa devem registrar evidências. A branch de trabalho e o PR permanecem separados da main e de produção até revisão e autorização.
