# Contrato proposto — API de funcionários V1

Data: 17/11/2026. Para implementação do backend e desenvolvimento do frontend pelo Arthur. Rotas NOVAS abaixo ainda não existem. Rotas COMPARTILHADAS existem, mas precisam da extensão de autorização/propriedade descrita. Não assumir que adicionar role ao JWT já torna uma rota compatível.

Desenho de referência: `docs/superpowers/specs/2026-11-17-funcionarios-backend-design.md`.

## 1. Convenções

- JSON UTF-8; upload multipart com campo `file`. E-mail pessoal ou institucional válido, sem allowlist de domínio.
- Identificadores UUID. Nenhum cadastro exige RA ou matrícula funcional. `accountId`, `id`, permissões e versões não são escolhidos pelo usuário.
- Datas funcionais YYYY-MM-DD; validade inclusiva em America/Sao_Paulo. Instantes técnicos ISO8601 com fuso/UTC.
- Privado: Bearer e Cache-Control:no-store. E=employee autenticado, conta ACTIVE; S=secretary ativo. Elegibilidade do vínculo é uma verificação adicional para registrar presença/validar carteirinha.
- `expectedVersion` é a versão de Employee, inclusive edição de função/foto. Falha concorrente retorna409; frontend deve recarregar, nunca sobrescrever silenciosamente.
- Listas novas: `{items,nextCursor,total?}`, `limit` padrão25/máximo100. Busca `q` normalizada, ordenação padrão por nome e ID para desempate. Rotas existentes preservam seus envelopes.
- Registrar caminhos estáticos (`me`, `fotos`, `importacoes`, `modelo-importacao`) antes de `:id`; parâmetros UUID validados.

## 2. Autenticação — NOVAS

| Método e rota | Acesso | Entrada e resultado |
|---|---|---|
| POST /autenticacao/funcionarios/login | Público limitado | `{email,password}`;200 `{token,mustChangePassword:false,profileType:"employee",expiresAt}`. Não emite JWT geral antes de ativar senha. |
| POST /autenticacao/funcionarios/solicitar-acesso | Público limitado | `{email}`;202 genérico. Envia link individual se cadastro apto e senha ainda não definida. |
| POST /autenticacao/funcionarios/ativar | Público com token de ação | `{token,newPassword}`;200 `{activated:true}`. Token ACTIVATE24h, uso único. Depois realizar login normal. |
| POST /autenticacao/funcionarios/forgot-password | Público limitado | `{email}`;202 genérico, token RESET_PASSWORD30min. |
| POST /autenticacao/funcionarios/reset | Público com token de ação | `{token,newPassword}`;200 `{reset:true}`. Invalidar sessões anteriores via authVersion. |
| POST /autenticacao/funcionarios/alterar-senha | E | `{currentPassword,newPassword}`;200 `{changed:true,reauthenticate:true}`. |
| POST /funcionarios/:id/convite | S | `{requestId,expectedVersion}`;202 com situação de solicitação, sem devolver token de ativação. |
| GET /funcionarios/:id/acesso | S | `passwordDefined,lastLoginAt,lastAccessRequestAt,lastDeliveryState`; nunca hash/senha/token. |

Claims employee: `sub=Employee.id`, `accountId`, `role=employee`, `authVersion`, `iat`, `exp`. JWT30 dias, como configuração atual. Guard revalida authVersion/conta em cada operação employee; vínculo ativo é exigido apenas nas operações correspondentes. Cargo não entra como papel de autorização.

As rotas genéricas de senha/primeiro acesso já existentes devem continuar aceitando somente seus perfis suportados ou tratar employee explicitamente. Eliminar o fallback que interpretaria employee como secretary. Arthur usará as rotas específicas acima.

Logout do frontend apaga credencial local e revoga sua sessão offline. Não prometer revogação por dispositivo do JWT stateless sem desenvolver sessão por dispositivo; bloqueio, senha e e-mail invalidam todas as sessões employee por authVersion. Essa limitação é distinta da sessão offline revogável.

Rate limit técnico inicial: solicitações de acesso/recuperação até3 por e-mail normalizado em15min e20 por IP em15min; login até10 falhas por par IP/e-mail em15min. Chaves sem e-mail em claro nos logs. Respostas de solicitação não revelam cadastro nem entrega. Falha ao enviar é registrada administrativamente; ACCEPTED não significa entrega na caixa postal.

## 3. Funcionário — NOVAS

| Método e rota | Acesso | Resultado |
|---|---|---|
| GET /funcionarios/me | E | Perfil próprio, funções e versões, sem passwordHash ou tokens de ação. |
| GET /funcionarios/me/carteirinha | E | Projeção para carteirinha, elegibilidade, foto aprovada e URL pública de validação. Pode retornar valid=false sem impedir histórico. |
| GET /funcionarios/me/foto | E | Situação da foto atual e pendente; URLs de conteúdo autorizadas. |
| POST /funcionarios/me/foto | E | multipart(file,requestId,expectedVersion);201 se foto recebida e pendente de análise. GET consulta resultado incerto. |
| DELETE /funcionarios/me/foto | E | `{requestId,expectedVersion}`;200. Remove referências atuais, agenda remoção do asset e atualiza motivo da carteirinha. |
| GET /funcionarios/me/fotos/:photoId/conteudo | E dono | Imagem aprovada/pendente própria, sem expor chave do provedor. |

Alterações de nome, RG, matrícula, funções e validade são administrativas. Funcionário solicita correção pelo suporte, não envia PATCH privilegiado no perfil.

### Exemplo de resposta de perfil

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "accountId": "22222222-2222-4222-8222-222222222222",
  "profileType": "EMPLOYEE",
  "name": "Pessoa de Demonstração",
  "socialName": null,
  "displayName": "Pessoa de Demonstração",
  "email": "pessoa@example.test",
  "registrationNumber": null,
  "rg": null,
  "admissionDate": "2024-02-01",
  "accountStatus": "ACTIVE",
  "version": 3,
  "assignments": [
    {"id":"33333333-3333-4333-8333-333333333333","title":"Docente","startsOn":null,"validUntil":null,"active":true,"effectiveStatus":"ACTIVE"},
    {"id":"44444444-4444-4444-8444-444444444444","title":"Coordenador de DSM","startsOn":"2026-01-01","validUntil":"2026-12-20","active":true,"effectiveStatus":"ACTIVE"}
  ],
  "credential": {"valid":true,"validityKind":"INDETERMINATE","validUntil":null,"reasonCode":null,"checkedAt":"2026-11-17T15:00:00Z"},
  "photo": {"approvedPhotoId":"55555555-5555-4555-8555-555555555555","pendingPhotoId":null,"reviewStatus":"APPROVED"}
}
```

`effectiveStatus`: ACTIVE, FUTURE, EXPIRED, ENDED ou ARCHIVED. Perfil do titular pode conter RG; carteirinha/cache mínimo e validação pública têm projeções próprias.

## 4. Gestão de pessoas — NOVAS

| Método e rota | Acesso | Contrato |
|---|---|---|
| GET /funcionarios | S | `q,accountStatus,credentialStatus,hasRegistration,includeArchived,cursor,limit`; nome, matrícula, situação, resumo de funções/foto. Sem RG/token público. |
| POST /funcionarios | S | Cadastro e funções numa transação;201. `requestId` obrigatório para replay seguro. |
| GET /funcionarios/:id | S | Detalhe e versão do agregado. |
| PATCH /funcionarios/:id | S | `{expectedVersion,reason,...camposPermitidos}`;200. Sem alteração de id/accountId ou permissão. |
| POST /funcionarios/:id/status | S | `{expectedVersion,reason,status:ACTIVE|BLOCKED}`;200. |
| DELETE /funcionarios/:id | S | `{expectedVersion,reason}`;200; arquivamento lógico, invalidação de acesso, sem excluir histórico. |
| POST /funcionarios/:id/restaurar | S | `{expectedVersion,reason}`;200; restaura conta, não reativa automaticamente funções encerradas. |
| GET /funcionarios/:id/historico | S | Eventos/certificados pelo vínculo employee, com tipo e versões; leitura sem emitir. |
| GET /funcionarios/:id/auditoria | S | Histórico paginado, valores sensíveis mascarados. |
| POST /funcionarios/:id/qrcode/renovar | S | `{requestId,expectedVersion,reason}`;200; invalida QR anterior sem alterar identidade/histórico. Não necessário ao renovar função. |

### Criar pessoa

```json
{
  "requestId":"66666666-6666-4666-8666-666666666666",
  "name":"Pessoa de Demonstração",
  "socialName":null,
  "email":"pessoa@example.test",
  "registrationNumber":null,
  "rg":null,
  "admissionDate":"2024-02-01",
  "assignments":[
    {"title":"Docente","startsOn":null,"validUntil":null,"active":true},
    {"title":"Coordenador de DSM","startsOn":"2026-01-01","validUntil":"2026-12-20","active":true}
  ]
}
```

Name3–160; socialName3–160 quando presente; title2–120; matrícula1–40; RG1–24 quando informado; email até254. Trim/espaços normalizados. Não exigir foto no mesmo POST; carteirinha aguarda aprovação da foto. Conta nasce sem senha e não recebe senha em arquivo/JSON.

## 5. Funções — NOVAS

| Método e rota | Acesso | Contrato |
|---|---|---|
| GET /funcionarios/:id/funcoes | S | Funções/histórico, `includeArchived`. |
| POST /funcionarios/:id/funcoes | S | `{expectedVersion,reason,title,startsOn?,validUntil?,active}`. |
| PATCH /funcionarios/:id/funcoes/:assignmentId | S | `{expectedVersion,reason,...campos}`; active=false encerra; active=true reativa explicitamente. |
| DELETE /funcionarios/:id/funcoes/:assignmentId | S | `{expectedVersion,reason}`; arquiva função, não a pessoa. |
| POST /funcionarios/:id/funcoes/:assignmentId/restaurar | S | `{expectedVersion,reason}`; restaura como inativa para revisão, sem prolongar validade automaticamente. |

Toda resposta mutável inclui nova `version` de Employee e `credential` recalculada. Nenhum controller aceita assignmentId pertencente a outra pessoa. Campos ausentes preservam valor; null limpa somente campos opcionais explicitamente permitidos.

## 6. Aprovação de fotos — NOVAS

| Método e rota | Acesso | Contrato |
|---|---|---|
| GET /funcionarios/fotos/pendentes | S | Fila paginada de pedidos prontos para análise, employeeId/photoId/version. |
| GET /funcionarios/fotos/resumo | S | `{pendingCount}` para indicador no menu. |
| GET /funcionarios/:id/fotos/:photoId/conteudo | S | Imagem para análise, restrita ao funcionário indicado. |
| POST /funcionarios/:id/foto | S | Upload em nome da pessoa, mesmo contrato de requestId/limites; ainda exige aprovação explícita. |
| PATCH /funcionarios/:id/fotos/:photoId/avaliacao | S | `{expectedVersion,approved,reason?}`; motivo obrigatório na rejeição. |
| DELETE /funcionarios/:id/foto | S | `{expectedVersion,reason}`; limpa foto atual e pendente, agenda descarte. |

Limite200KB e JPG/PNG/WebP, validação de bytes/dimensões. Upload fica em armazenamento privado por chave gerada no servidor. Prévia de candidato exige autorização; foto atual aprovada só é disponibilizada publicamente no contexto de QR válido. Não expor URLs arbitrárias ou aceitar URL enviada como caminho de exclusão.

## 7. Importação CSV/XLSX — NOVAS

| Método e rota | Acesso | Resultado |
|---|---|---|
| GET /funcionarios/modelo-importacao?format=csv|xlsx | S | Modelo fictício, descrição e versão1.0. |
| POST /funcionarios/importacoes/analisar | S | multipart(file,mode=CREATE_ONLY|UPDATE);201 batch com diagnóstico; não cadastra/envia e-mail. |
| GET /funcionarios/importacoes/:batchId | S dono ou administrador autorizado | Estado, revision, reviewDigest, contagens. |
| GET /funcionarios/importacoes/:batchId/linhas | S autorizado | Diagnóstico paginado por linha/grupo e seleção elegível; sem tokens/senhas. |
| POST /funcionarios/importacoes/:batchId/confirmar | S autorizado | `{requestId,revision,reviewDigest,selectedGroupIds}`;202; não aceita dados da pessoa reescritos pelo cliente. |
| POST /funcionarios/importacoes/:batchId/cancelar | S autorizado | `{requestId,reason}`; interrompe grupos ainda não iniciados; concluídos permanecem registrados. |
| POST /funcionarios/importacoes/:batchId/reprocessar | S autorizado | `{requestId,groupIds}` somente grupos recuperáveis; consulta resultado antes de repetir escrita incerta. |
| GET /funcionarios/importacoes/:batchId/relatorio?format=csv|xlsx | S autorizado | Resultados com status, linha, código de erro e employeeId; sem RG no relatório resumido. |

Política inicial: somente o criador do lote pode aplicar/cancelar/reprocessar; outra Secretaria pode consultar o resumo administrativo, mas não se apropriar silenciosamente da aprovação. Futuro mecanismo de transferência depende de requisito próprio. Revalidar que o criador ainda é ativo em cada operação e antes de executar grupo no worker.

### Colunas e regras

| Coluna | Criação | Atualização |
|---|---|---|
| funcionario_id | Vazio | Obrigatório, ID existente; nunca criado pelo CSV. |
| funcao_id | Vazio | Obrigatório para editar função existente; vazio cria função somente se explicitamente aprovado na prévia. |
| nome_completo | Obrigatório | Ausente preserva. |
| nome_social | Opcional | Branco preserva no UPDATE; limpeza por formulário explícito. |
| email | Obrigatório | Alteração deve apontar funcionario_id e verificar conflito. |
| matricula_funcional | Opcional, texto | Não usada para sobrescrever identidade. |
| rg | Opcional | Dado restrito; não usar como senha. |
| data_admissao | Obrigatório | Ausente preserva. |
| funcao | Obrigatório | Texto personalizável. |
| inicio_funcao | Opcional | Vazio significa não informado na criação; preserva no UPDATE. |
| fim_funcao | Opcional | Vazio significa indeterminado na criação; preserva no UPDATE. Para remover vencimento usar edição explícita. |
| funcao_ativa | SIM padrão destacado | Obrigatório ao alterar situação; ausência preserva. |

CSV1 linha por função, por exemplo:

```csv
nome_completo,nome_social,email,matricula_funcional,rg,data_admissao,funcao,inicio_funcao,fim_funcao,funcao_ativa
Pessoa de Demonstração,,pessoa@example.test,,,2024-02-01,Docente,,,SIM
Pessoa de Demonstração,,pessoa@example.test,,,2024-02-01,Coordenador de DSM,2026-01-01,2026-12-20,SIM
```

Mesmo esquema na aba Funcionarios do XLSX. Limites2MB/1.000 linhas. Grupo com dados pessoais conflitantes é inválido, não vence a última linha. Identificadores e emails que apontam para pessoas diferentes bloqueiam o grupo. Hash de arquivo não autoriza atualizar versões novas do cadastro.

### Confirmação

```json
{
  "requestId":"77777777-7777-4777-8777-777777777777",
  "revision":1,
  "reviewDigest":"digest-retornado-pelo-servidor",
  "selectedGroupIds":["88888888-8888-4888-8888-888888888888"]
}
```

Erro em uma pessoa não desfaz outras. `groupKey` interno e groupId da prévia não são IDs de funcionário escolhidos pelo cliente. Registrar audit por pessoa e lote; invitar por e-mail é uma ação separada, não efeito da análise/upload.

## 8. Validação pública e informações institucionais

| Método e rota | Tipo | Resultado |
|---|---|---|
| GET /funcionarios/verificar/:qrcode | NOVA pública limitada | Situação atual com projeção mínima. |
| GET /funcionarios/verificar/:qrcode/foto | NOVA pública limitada | Foto aprovada somente se validação atual permitir; no-store. |
| GET /public/institution | NOVA pública | Nome fixo da Fatec Itaquera e contatos configurados/confirmados; campo sem informação confiável retorna null. |
| GET /project-credits | EXISTENTE sem alteração de domínio | Créditos publicados, compartilhados pelos portais. |

Resposta válida de QR: `{valid:true,profileType:"EMPLOYEE",displayName,activeAssignments:[{title}],validityKind,validUntil,photoUrl,checkedAt}`. Não devolver RG, email, passwordHash, tokens de acesso ou informações administrativas. Para documento conhecido inválido, devolver valid=false/reasonCode/checkedAt, sem detalhes pessoais. Token inexistente ou renovado404. Limitar tentativas para evitar enumeração; qrcode tem entropia mínima128 bits.

A interface do funcionário recebe `verificationUrl` em GET me/carteirinha, construída com EMPLOYEE_APP_URL, e não inventa o endereço a partir de matrícula. Cache offline é responsabilidade do frontend e precisa mostrar checkedAt; endpoint de validade só prova estado online no instante da consulta.

## 9. Eventos e certificados — COMPARTILHADAS A ESTENDER

| Rotas existentes | Extensão employee |
|---|---|
| GET /events e /events/:id | Permitir employee nas leituras, preservando filtros e formato. Nenhuma permissão de editar evento. |
| GET /public/events/qr/:reference | Mesmo QR/estado/visitorsAllowed/locationRequired; funcionário não é visitante. Metadados de entrada podem indicar portal employee configurado. |
| GET /attendances/qr/:reference | Permitir employee; prévia não cria presença. |
| POST /attendances/scan e /scan-reference | Resolver conta employee autenticada, mesmas regras/locks/GPS; ignorar alegação de cargo como autorização. |
| POST /attendances/location-challenge | Desafio atrelado a employeeAccountId/participantId e etapa vigente; sem posição reaproveitada. |
| GET /attendances/me | Histórico somente da identidade autenticada; employee nunca recebe histórico de aluno homônimo. |
| GET /certificates/me, /:id e /:id/pdf | Dono employee via participant.employeeAccountId. Mesma emissão/download, com projeção neutra adicional. |
| GET /certificates/verify/:code | Manter verificação pública/revogação. Acrescentar recipientType e displayName para employee, preservando campos legados. |
| POST /public/events/:id/feedback | Pesquisa anônima atual; não anexar employeeId à resposta nem exigir pesquisa para baixar PDF. |
| GET /events/:id/attendances e /summary | Administração reconhece tipo de participante sem expor RG/email em lista pública. |
| GET /event-management/events/:id/participants | Incluir identityType EMPLOYEE e resumo compatível; não inferir tipo por matrícula ausente. |
| POST /event-management/events/:id/manual-certificates | Adicionar identityType EMPLOYEE, employeeId e expectedAccountId; mesmas confirmação/justificativa/idempotência. |
| POST /event-management/events/:id/manual-checkouts e /manual-presence | Abranger employee identificado, sem inventar leitura de QR/GPS. |
| POST /event-management/events/:id/participant-file | Tipo funcionario explícito para matching employee; formato antigo sem tipo mantém comportamento de aluno. Homônimos entre perfis exigem decisão explícita. |
| POST /event-management/participants/:id/role e PATCH /participants/:id | Validar funcionário; papel no evento continua ATTENDEE/SPEAKER, separado de cargo. |
| Rotas administrativas de versões/reissue/retry/reconcile-delivery | Mesmo serviço, incluindo destinatário employee, preservando revogação e AMBIGUOUS. |

Rotas NOVAS de apoio administrativo: `GET /event-management/employees/search?q=...` e `GET /event-management/employees/:id/history`, somente S. Não criar outro painel/evento/gerador no backend.

Modelo administrativo manual:

```json
{
  "requestId":"99999999-9999-4999-8999-999999999999",
  "identityType":"EMPLOYEE",
  "employeeId":"11111111-1111-4111-8111-111111111111",
  "expectedAccountId":"22222222-2222-4222-8222-222222222222",
  "participationConfirmed":true,
  "reason":"Participação conferida pela organização."
}
```

DTO de novo certificado employee inclui `recipient:{type:"EMPLOYEE",displayName,registrationNumber}`. Snapshot pode conservar studentName para o renderizador legado; Arthur usa displayName/recipient no frontend novo. Nunca representar funcionário com RA fictício. PDF default omite identificação inexistente; PDF personalizado usa mesmo modelo/assinantes do evento.

## 10. Presença offline — NOVAS

| Método e rota | Autorização |
|---|---|
| POST /attendances/employee-offline/session | JWT employee válido + Origin. Retorna accountId/expiresAt e cookie opaco HttpOnly. |
| POST /attendances/employee-offline/submit | Cookie restrito + Origin; `{requestId,accountId,reference,scannedAt}`. |
| POST /attendances/employee-offline/status | Cookie + Origin; `{accountId,requestIds}` máximo50. |
| POST /attendances/employee-offline/revoke | Cookie + Origin; revoga sessão atual e limpa cookie. |

Proxy do portal deve encaminhar `/api/attendances/employee-offline/*` ao prefixo acima, preservando Cookie/Set-Cookie/Origin. Nome proposto `event_employee_offline`, Path `/api/attendances/employee-offline`, SameSite=Strict, Secure em HTTPS; validade min(expJWT,24h). JWT geral não vai ao worker/IndexedDB.

Consultar recibo existente antes de revalidar QR/janela; ele prova operação já aceita. Nova tentativa só aceita se função/conta/etapa estiverem válidas na hora do servidor, e GPS estiver explicitamente desabilitado. GPS obrigatório retorna LOCATION_REQUIRED e exige app visível/posição nova. Horário declarado não estende prazo. Recibo/presença/certificado compartilham transação, usando a mesma conexão. Cookie não autoriza perfil, suporte ou downloads.

Recebimento confirmado segue o formato atual de ScanResponse dentro do recibo. Sem rede, revogação remota não é instantânea; frontend precisa parar autorização local antes de sair.

## 11. Suporte — COMPARTILHADAS A ESTENDER

Funcionário usa as mesmas rotas do aluno: `POST /support/tickets`, `GET /support/tickets/me`, `GET /support/tickets/:id` e `POST /:id/messages|read|close|cancel|delete|reopen`.

Secretaria continua usando `/support/admin/summary`, `/assignees`, `/tickets`, `/tickets/:id`, `/tickets/:id/audit`, `/tickets/:id/read|claim|messages|status|cancel|delete`, PATCH `/tickets/:id/assignee` e POST `/tickets/:id/messages/:messageId/redact`.

Extensões: filtro admin `ownerType=STUDENT|EMPLOYEE`; resumo mantém total geral e acrescenta contagem por tipo; mensagens privadas não vazam entre perfis. Proprietário employee é derivado do JWT, nunca de employeeId enviado no POST. Categorias mantêm DATA/PHOTO_CARD/EVENT/CERTIFICATE/ACCESS/OTHER. Campos solicitados para correção não são aplicados automaticamente no cadastro. Cancelamento/exclusão seguem a política atual e preservam trilha autorizada.

## 12. Erros e integração

Envelope novo: `{statusCode,code,message,fieldErrors?,requestId?,currentVersion?}`. Não mudar envelope de toda API como parte da feature.

| HTTP | Exemplos |
|---|---|
| 400 | VALIDATION_ERROR, IMPORT_SCHEMA_INVALID, DATE_RANGE_INVALID, TOKEN_INVALID_OR_EXPIRED, LOCATION_REQUIRED; códigos atuais de QR/janela preservados. |
| 401 | UNAUTHORIZED, SESSION_REVOKED, OFFLINE_SESSION_REQUIRED. |
| 403 | ROLE_FORBIDDEN, ACCOUNT_BLOCKED, NO_ACTIVE_ASSIGNMENT nas operações que exigem vínculo, ORIGIN_MISMATCH. |
| 404 | EMPLOYEE_NOT_FOUND, PHOTO_NOT_FOUND, QR_NOT_FOUND; não revelar existência de recurso de outra conta. |
| 409 | EMAIL_ALREADY_EXISTS, REGISTRATION_ALREADY_EXISTS, VERSION_CONFLICT, REQUEST_ID_REUSED, PHOTO_VERSION_CONFLICT, IMPORT_REVIEW_CHANGED, IMPORT_ROW_STALE. |
| 413/415 | FILE_TOO_LARGE / FILE_TYPE_NOT_ALLOWED. |
| 429 | RATE_LIMITED com Retry-After. |
| 503 | STORAGE_UNAVAILABLE ou serviço necessário indisponível; falha transitória não vira rejeição definitiva no cliente. |

Endpoints de primeiro acesso/recuperação mantêm resposta genérica202 mesmo para cadastro inexistente; erro de infraestrutura fica auditado com dados mínimos. Não retornar422 diferente que enumere email existente.

Dependências para publicar: EMPLOYEE_APP_URL HTTPS real, CORS explícito, remetente Brevo já usado pela aplicação e armazenamento Cloudinary já existente. Não presumir acesso externo validado por testes com mocks. Entregar ao Arthur fixtures fictícias de sem matrícula, múltiplas funções, vencimento, foto pendente, conta bloqueada, conflitos409, importação parcial e recibo perdido.
