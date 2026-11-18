# Plano de implementação do Frontend de Funcionários

Fatec Itaquera · Auditoria de 17/11/2026 · [Issue #1](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-funcionarios/issues/1)

## 1. Resumo da auditoria

Portar seletivamente o layout e a experiência do aluno, aplicar os tokens azul-petróleo da secretaria e integrar os serviços V1 de funcionários. A inspeção estática verificou registro de módulos, controllers, guards, DTOs, serviços, migração e testes de referência. Os fluxos necessários têm implementação na main do backend. E-mail, armazenamento, banco, origens, deep links e comportamento integrado ainda precisam de homologação.

A Home mantém Minha Carteirinha, Enviar Foto, QR de validação da carteirinha, Configurações, Solicitações com indicador de não lidas, Informações da Unidade, créditos, nome e foto do titular e logout. Eventos e palestras, visitantes, listagem e detalhe de eventos, leitor de presença, check-in/out, histórico, avaliação, presença offline e emissão, verificação, visualização e download de certificados ficam fora do portal, inclusive por URL direta. Gestão de funcionários e moderação de fotos pertencem à secretaria.

## 2. Estado das branches main e contratos

| Repositório | Commit auditado | Estado |
| --- | --- | --- |
| Funcionários | [2e7374befd16](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-funcionarios/tree/2e7374befd16e64bdd841f19d91329301b882670) | README, contrato e guia com tipos, OpenAPI e fixtures. Sem aplicação, dependências ou build. |
| Aluno | [880745a14016](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-aluno/tree/880745a1401615592dd9561d671fb5783b3db011) | React 19, TS 6, Vite 7, React Router 7, CSS Modules e VitePWA/Workbox. Domínio Student e funcionalidades de eventos acopladas a algumas telas comuns. |
| Secretaria | [5eb1cc339cab](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-secretaria/tree/5eb1cc339cabb415627fa84481b0176ca65a75c5) | React 19, Vite, sessão e menus administrativos próprios, CSS Modules, tokens globais e Vitest. |
| Backend | [e488c482fb32](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/tree/e488c482fb3277ac940be4d7452cec86ca6fdcfa) | NestJS, Prisma/PostgreSQL, módulos Employee, Support, Institution, ProjectCredits, migração 20261117000000_employee_domain e testes Jest. |

Foram lidos o [contrato HTTP](CONTRATO_API_FUNCIONARIOS.md), [guia de regras](FUNCIONALIDADES_E_REGRAS_FRONTEND.md), [tipos employee](contracts/v1-employees.types.ts), [tipos de eventos](contracts/v1-events.types.ts), [OpenAPI](contracts/v1-employees.openapi.json) e [fixtures](contracts/fixtures/employees.fixture.json). Tipos employee, OpenAPI e fixtures coincidem com as três cópias correspondentes de src/contracts do backend nos commits auditados. As fixtures úteis cobrem matrícula ausente, múltiplas funções, expiração, foto pendente, bloqueio, projeções de QR e conflito. Tipos de eventos, casos de importação e recibo offline delimitam exclusões.

## 3. Matriz de funcionalidades e comparação com aluno

| Decisão | Referência do aluno | Aplicação no portal |
| --- | --- | --- |
| Reutilizar | ButtonComp, InputComp, InputPasswordComp, TitleComp, SpacerComp, Modal, MessageModal, ErrorModal, ButtonGrid, AuthLayout, PageLayout e InternetWatcher | Preservar composição, CSS Modules, foco, validação visual e estados de carregamento. Aplicar tokens no tema central. |
| Reutilizar | ProjectCreditsScreen, projectCreditsService e projectCreditContact | Mesma leitura pública, apresentação e tratamento dos contatos. Validar links e fotos. |
| Adaptar | MainMenuScreen, StudentPhoto, PhotoStatus | Manter grade e navegação, retirar atalhos e acoplamentos de eventos, usar displayName e foto autorizada. |
| Adaptar | DigitalStudentCardScreen, DigitalStudentQrCode, TelaQrcode e componentes de validação | Manter apresentação e projeção do QR com qrcode.react. Substituir RA/curso por dados funcionais. Consumir URL fornecida pelo servidor. |
| Adaptar | UploadImageScreen, imageProcessing.ts | Portar experiência de seleção, recorte, compressão e prévia. Substituir upload, remoção, versão e estados de análise. |
| Adaptar | ConfigScreen, HelpScreen e SupportScreen | Preservar preferências de acessibilidade e apresentação, trocar senha genérica e chaves locais, adaptar formulários de suporte. |
| Adaptar | useUnreadRequests | Manter paginação, deduplicação e 99+. Contar tickets com unread, atualizar em foco/reconexão e após leitura. Vincular à sessão e limpar/cancelar ao sair para impedir corrida entre contas. |
| Desenvolver | LoginScreen e telas de primeiro acesso/recuperação como referência visual | Funcionário usa e-mail, senha e token de ação por link. O aluno usa CPF/código e um guard legado baseado em mustChangePassword. Criar cliente, contexto e guard próprios. |
| Desenvolver | domains/Student.ts, models/Student.ts, api/student e api/auth como referência de organização | Criar domínio employee, adaptadores de projeções, serviços V1 e serviço institucional. |
| Remover da transferência | screens/{events,attendance,scanner,certificates}, api/{attendance,events,certificate}, eventService, tipos, mocks e testes respectivos | Excluir proxies, fila offline, links públicos, rotas de visitantes/feedback, atalhos ocultos, exports e dependências exclusivas. |

Copiar os arquivos selecionados com referência ao commit do aluno, mantendo package.json, lockfile, scripts e configuração de build próprios. Evitar submódulo ou dependência de um portal sobre o outro. A secretaria fornece tokens de cor e referência de estados. Seus layouts administrativos, menus e clientes de API ficam no repositório de origem. [Rotas](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-aluno/blob/880745a1401615592dd9561d671fb5783b3db011/src/routes/index.tsx) · [Home](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-aluno/blob/880745a1401615592dd9561d671fb5783b3db011/src/ui/screens/mainmenu/MainMenuScreen.tsx) · [Configurações](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-aluno/blob/880745a1401615592dd9561d671fb5783b3db011/src/ui/screens/config/ConfigScreen.tsx) · [Scripts do aluno](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-aluno/blob/880745a1401615592dd9561d671fb5783b3db011/package.json)

## 4. Endpoints necessários e compatibilidade

Os grupos abaixo têm implementação registrada. Os códigos de resposta foram identificados na inspeção estática. As suítes existentes não foram executadas nesta auditoria.

| Método e caminho | Comportamento no backend | Trabalho de integração ou pendência |
| --- | --- | --- |
| POST /autenticacao/funcionarios/login | Público limitado. E-mail e senha → 200 com token, profileType employee, mustChangePassword false e expiresAt | Trocar contrato do aluno. Confirmar expiração real, conta sem senha, bloqueada e rate limit. |
| POST /autenticacao/funcionarios/solicitar-acesso e /autenticacao/funcionarios/forgot-password | Público limitado. E-mail → 202 genérico | Confirmar respostas equivalentes, 429 e entrega dos links. |
| POST /autenticacao/funcionarios/ativar e /autenticacao/funcionarios/reset | token + newPassword → 200. Uso único. Ativação 24 h, reset 30 min | Testar consumo concorrente, uso repetido e expiração. |
| POST /autenticacao/funcionarios/alterar-senha | Bearer employee ativo. currentPassword + newPassword → 200 e reautenticação | Revalidar invalidação de JWT anterior. |
| GET /funcionarios/me e /funcionarios/me/carteirinha | Titular. Perfil e projeção distinta da credencial com QR, foto e checkedAt | Usar cada projeção na tela correspondente. Confirmar URL absoluta do QR, foto e múltiplas funções. |
| GET /funcionarios/me/foto e /funcionarios/me/fotos/:photoId/conteudo | Titular. Estado e versão da foto, download autorizado | Resolver URLs no cliente da API, buscar bytes com Bearer e usar URL temporária revogável. Testar isolamento entre titulares. |
| POST /funcionarios/me/foto | Titular. Multipart file, requestId e expectedVersion → 201 | JPEG/PNG/WebP até 204800 bytes. Confirmar validação por bytes, storage, replay do mesmo conteúdo e 409. |
| DELETE /funcionarios/me/foto | Titular. JSON com expectedVersion e requestId conforme contrato Markdown | Verificar corpo atrás do proxy, descarte assíncrono e estado após resposta perdida. |
| GET /funcionarios/verificar/:qrcode e /funcionarios/verificar/:qrcode/foto | Públicos limitados. Conhecido inválido → 200 sem dados pessoais. Inexistente/rotacionado → 404. Foto pública só no estado válido | Testar QR em outro dispositivo, resolução de foto relativa à API, 429, rede indisponível e privacidade. Sem Bearer. |
| POST /support/tickets, GET /support/tickets/me, GET /support/tickets/:id | Compartilhados. Identidade vem do JWT, proprietário employee por accountId | Usar categoria, UUID e conteúdo do DTO. Cobrir ownership entre funcionários, alunos e secretaria, filtros e paginação. |
| POST /support/tickets/:id/{messages,read,close,cancel,delete,reopen} | Compartilhados. Ações conforme estado. Escritas usam requestId e expectedVersion. Leitura usa version | Atualizar tela e badge, tratar 409 com recarga. Verificar permissões de cada transição e suporte com conta bloqueada/revogada. |
| GET /public/institution | Público. Identidade fixa, endereço padrão configurável e contatos opcionais | Confirmar dados institucionais e ocultar links ausentes. |
| GET /project-credits e /project-credits/:id/photo/:token | Públicos. Créditos publicados e fotos quando disponíveis | Reaproveitar serviço do aluno. Validar HTTPS das fotos com PUBLIC_API_URL atrás de proxy. |

Fontes do backend: [registro dos módulos](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/e488c482fb3277ac940be4d7452cec86ca6fdcfa/src/app.module.ts), [autenticação](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/e488c482fb3277ac940be4d7452cec86ca6fdcfa/src/employee/employee-auth.controller.ts), [titular](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/e488c482fb3277ac940be4d7452cec86ca6fdcfa/src/employee/employee-self.controller.ts), [fotos](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/e488c482fb3277ac940be4d7452cec86ca6fdcfa/src/employee/employee-photo.service.ts), [validação pública](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/e488c482fb3277ac940be4d7452cec86ca6fdcfa/src/employee/employee-public.controller.ts), [suporte](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/e488c482fb3277ac940be4d7452cec86ca6fdcfa/src/support/support.controller.ts), [instituição](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/e488c482fb3277ac940be4d7452cec86ca6fdcfa/src/institution/institution.config.ts) e [créditos](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/e488c482fb3277ac940be4d7452cec86ca6fdcfa/src/project-credits/project-credits.controller.ts).

## 5. Divergências, dependências e riscos

| Prioridade | Evidência | Encaminhamento para validação |
| --- | --- | --- |
| Alta | Markdown descreve rotas novas como inexistentes e suporte como extensão futura. OpenAPI tem sumários, sem schemas, parâmetros e respostas detalhados, e omite suporte e créditos. | Atualizar estado e detalhar contratos compartilhados em revisão documental posterior. |
| Alta | Backend gera /ativar-acesso?token=…, /redefinir-senha?token=… e /funcionarios/verificar/:qrcode no host employee. Sem EMPLOYEE_APP_URL os links por e-mail falham e a URL de QR fica relativa. | Configurar origem HTTPS exata e documentar caminhos. Preservar deep links da SPA, separando host ou prefixo de API do path público homônimo. |
| Alta | Rejeição desmarca currentPending. GET /funcionarios/me/foto seleciona só a foto marcada e pode devolver pending null. credential.reasonCode indica rejeição quando impede a credencial. Com foto anterior aprovada, a nova rejeição pode ficar invisível. | Testar ambos os casos. Se o resultado ou motivo não estiver disponível ao titular, alinhar a projeção com o backend antes de aceitar o acompanhamento completo. |
| Média | DELETE de foto tem requestId opcional no tipo e no DTO. O Markdown lista requestId e expectedVersion. O upload faz replay explícito pelo UUID. | Enviar ambos no portal, atualizar por GET após perda de resposta e confirmar comportamento de repetição de DELETE. |
| Média | Suporte retorna envelopes Nest e 409 sem currentVersion garantida. Versão de sessão divergente pode dar 403 em suporte, enquanto EmployeeAccountGuard usa 401 SESSION_REVOKED nas rotas employee. | Revalidar em /funcionarios/me antes de invalidar por 403 de suporte. Manter tratamento próprio do envelope legado. |
| Média | Suporte aceita EVENT e CERTIFICATE e requestedField inclui COURSE, além de NAME, SOCIAL_NAME, EMAIL e OTHER. | Omitir categorias excluídas e campo COURSE na UI. Usar OTHER para correções de matrícula, RG ou função, quando pertinente, preservando o DTO. |
| Média | Retry-After é descrito para 429, mas as respostas de login e QR auditadas não o definem explicitamente. ValidationPipe e limites de Multer podem gerar envelopes diferentes. | Tratar cabeçalho como opcional e testar 400/413/415/429 e falhas de storage via HTTP. |
| Média | QR inválido inclui profileType EMPLOYEE conforme tipos. O exemplo Markdown omite esse campo. Instituição tem endereço/cidade/UF/CEP padrão e telefone, e-mail e site opcionais. | Corrigir exemplos e validar INSTITUTION_* em homologação. |

Homologar PostgreSQL com migrações, JWT, EMPLOYEE_APP_URL e CORS, Brevo (BREVO_API_KEY e remetente EVENT_MAIL_SENDER verificado) e Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET). Confirmar URL pública dos créditos. O teste employee usa banco de integração e substitui MailService e UploadService, sem confirmação dos provedores reais. Registrar configuração necessária no exemplo de ambiente em revisão separada. O template de e-mail de employee tem cor de marca própria no backend, fora do tema da SPA. [Links](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/e488c482fb3277ac940be4d7452cec86ca6fdcfa/src/auth/password-recovery-url.ts) · [CORS](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/e488c482fb3277ac940be4d7452cec86ca6fdcfa/src/main.ts) · [Integração](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/e488c482fb3277ac940be4d7452cec86ca6fdcfa/src/employee/employee.integration.spec.ts) · [MailService](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/e488c482fb3277ac940be4d7452cec86ca6fdcfa/src/mail/mail.service.ts)

## 6. Autenticação, autorização e privacidade

- Rotas públicas para login, solicitação de acesso e recuperação, /ativar-acesso, /redefinir-senha, /funcionarios/verificar/:qrcode, ajuda e créditos. Rotas protegidas para Home, carteirinha, QR pessoal, foto, configurações e solicitações/listagem/detalhe. Usar guard único e reativo. Preservar navegação direta nas URLs emitidas pelo backend.
- Carregar /funcionarios/me após login employee. Backend valida assinatura, role, conta, status e authVersion. Uma função com nome de cargo administrativo não altera acesso. Uma conta ativa com credencial inválida continua elegível a foto e suporte.
- Proposta inicial de Bearer em memória, com novo login após recarga. Rever caso persistência seja requisito de produto. Isolar origens e chaves, cancelar consultas e limpar apenas estado e cache do funcionário ao sair. JWT stateless não tem revogação por dispositivo nesse fluxo. Manter tokens de ação fora de logs e armazenamento, retirar da URL após leitura. Sem JWT em IndexedDB ou Service Worker.
- Usar displayName, matrícula funcional opcional e múltiplas funções ACTIVE, FUTURE, EXPIRED, ENDED e ARCHIVED. Tratar YYYY-MM-DD como data civil com validade inclusiva em São Paulo. Exibir elegibilidade e checkedAt da API, mantendo perfil privado, dados da carteira e projeção pública separados. Correções cadastrais seguem pelo suporte.
- Em 409 de foto ou suporte, recarregar recurso e versão, preservar o rascunho da pessoa e confirmar nova tentativa quando aplicável. Em resposta incerta, consultar antes de repetir a mutação. Foto aprovada anterior segue visível enquanto a substituta aguarda análise.

## 7. Tema e PWA

Usar os tokens de [src/index.css da secretaria](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-secretaria/blob/5eb1cc339cabb415627fa84481b0176ca65a75c5/src/index.css). Preservar a geometria, tipografia, hierarquia, espaçamento, animações e pontos de quebra da base do aluno.

| Uso | Valores de origem |
| --- | --- |
| Marca, hover, suave | --app-color-primary #005C6D · --app-color-primary-hover #004652 · --app-color-primary-soft #eaf4f5 |
| Texto, secundário, superfície, fundo | --app-color-text #202f38 · --app-color-muted #52636b · --app-color-surface #fff · --app-color-background #f3f6f8 |
| Bordas | --app-color-border #dce5e9 · --app-color-input-border #7c9099 |
| Erro, sucesso, atenção | --app-color-danger #a42135 · --app-color-success #176342 · --app-color-warning #795210 |
| Foco visível | #0964c4 |

Mapear CSS Modules, estilos inline, assets e metadados. Aplicar em cabeçalhos, botões, ícones, cards, bordas, links, formulários, modais, foco e estados interativos. Preservar contraste e área silenciosa do QR. Conferir teclado, safe area e redução de movimento.

Reaproveitar VitePWA e instalação com manifesto, ícones e scope independentes. Pré-cache de assets públicos do shell, sem respostas autenticadas, fotos privadas ou validação pública. Retirar public/offline-presence.js, importScripts, mocks, proxies de presença/visitante e artefatos gerados dev-dist. Fallback somente para navegação da SPA. Na primeira versão offline, prever shell e aviso de indisponibilidade. Se houver aprovação para cache visual da carteira, limitar à projeção e foto aprovada mínimas com checkedAt, vínculo à sessão e expurgo, sem RG, e-mail, QR ou token. Validação pública exige consulta atual. [VitePWA do aluno](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-aluno/blob/880745a1401615592dd9561d671fb5783b3db011/vite.config.ts)

## 8. Estrutura e build

```text
src/
  api/{config,auth,employee,support,institution,projectCredits}/
  contexts/       # Sessão e preferências
  domains/        # Tipos V1, suporte e projeções
  routes/         # Rotas públicas e protegidas
  ui/components/  # Primitivas e componentes compartilhados
  ui/screens/     # Fluxos do titular e telas públicas
  ui/themes/      # Tokens da secretaria
  utils/          # Datas civis, imagens e utilitários
public/           # Manifesto e assets estáticos conforme estratégia VitePWA
tests/            # Contrato, unidade e navegador
docs/contracts/   # Referências versionadas
```

Manter scripts dev, build (tsc -b e Vite), lint e preview. Validar lockfile e versões do aluno durante a adaptação. Manter qrcode.react para gerar o QR. Eliminar dependências exclusivas da câmera, PDF e evento após verificar referências residuais.

## 9. Estratégia de testes

1. Reusar Node Test com tests/register.mjs e Playwright do aluno. Usar fixtures sintéticas e complementar rejeição com foto aprovada anterior, envelopes legados e datas de fronteira. Testar projeções, URLs, sessão, badge, FormData e DELETE JSON.
2. Rodar testes de contrato, elegibilidade, test:employees:migration e test:employees:integration em PostgreSQL descartável. A suíte existente prevê consumo concorrente de token, revogação, fotos, rotação de QR e suporte cruzado. Exercitar todas as ações de suporte com employee, 409 e falhas transitórias.
3. Homologar com contas sintéticas. Verificar o envio e recebimento de e-mail, CORS, fotos reais no provedor de teste, QR em outro aparelho, suporte, dados institucionais, fotos de créditos e perda de rede.
4. Rodar lint/build e comparar desktop/mobile com o aluno e os tokens da secretaria. Cobrir teclado e redução de movimento, deep links, instalação/atualização PWA, duas contas, logout e ausência de cache sensível. Inspecionar rotas, chamadas, bundle e worker para confirmar exclusões. [Scripts do aluno](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-aluno/blob/880745a1401615592dd9561d671fb5783b3db011/package.json) · [Scripts do backend](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/e488c482fb3277ac940be4d7452cec86ca6fdcfa/package.json)

## 10. Etapas após aprovação

1. Portar base seletiva, configurar build, tema, navegação e referências visuais.
2. Implementar autenticação, estados de sessão e deep links. Configurar ambiente e origem da API.
3. Implementar Home, perfil, carteirinha, QR e validação pública.
4. Integrar foto, versões, estados de aprovação/rejeição e remoção. Resolver lacuna de rejeição se reproduzida.
5. Adaptar Configurações, Solicitações e badge, Informações da Unidade e créditos.
6. Finalizar PWA, inspecionar exclusões e executar testes de integração, QA visual e homologação.

## 11. Checklist de aceite

- [ ] Home completa, inclusive foto, displayName, créditos, badge de não lidas e logout.
- [ ] Geometria e responsividade do aluno e cores da secretaria em telas públicas e privadas e nos estados interativos.
- [ ] Login exclusivo, links de uso único, recuperação, troca e revogação de sessão verificados.
- [ ] Matrícula opcional, múltiplas funções, datas, nome social e situação conforme a API. Correções por suporte.
- [ ] QR abre validação pública em outro aparelho, com estados válido, inválido, desconhecido e indisponível. Foto pública restrita ao QR válido.
- [ ] Foto privada com upload, prévia, aprovação, rejeição, remoção e conflito verificáveis com e sem foto anterior.
- [ ] Solicitações restritas ao titular, badge atualizado e papéis isolados.
- [ ] PWA instalável e independente. Rotas, worker e bundle sem eventos, scanner, presença ou certificados.
- [ ] Lint, build e testes sintéticos concluídos, com evidências de banco, e-mail, storage, CORS e QR ponta a ponta.
