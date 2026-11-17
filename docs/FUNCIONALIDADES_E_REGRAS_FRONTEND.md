# Portal dos Funcionários — Funcionalidades, Regras e Guia de Integração

Guia para o desenvolvimento do frontend do **Portal dos Funcionários** da Fatec Itaquera (adaptação da base do portal do aluno).

## Arquivos de contrato neste repositório

- Contrato HTTP detalhado: [`docs/CONTRATO_API_FUNCIONARIOS.md`](./CONTRATO_API_FUNCIONARIOS.md)
- Tipos TypeScript (sem dependências de runtime): [`docs/contracts/v1-employees.types.ts`](./contracts/v1-employees.types.ts) e [`docs/contracts/v1-events.types.ts`](./contracts/v1-events.types.ts)
- Especificação OpenAPI 3.1 (JSON): [`docs/contracts/v1-employees.openapi.json`](./contracts/v1-employees.openapi.json)
- Fixtures fictícias para mocks e estados de UI: [`docs/contracts/fixtures/employees.fixture.json`](./contracts/fixtures/employees.fixture.json)

---

## Funcionalidades previstas para o Portal dos Funcionários

1. **Primeiro acesso, login e recuperação de senha**
   - Login exclusivo em `POST /autenticacao/funcionarios/login` (`profileType: "employee"`).
   - Primeiro acesso por link individual (`POST /autenticacao/funcionarios/solicitar-acesso` → `POST /autenticacao/funcionarios/ativar`), sem senha derivada de RG/CPF.
   - Recuperação e troca de senha em `/autenticacao/funcionarios/forgot-password`, `/reset` e `/alterar-senha`.
   - Não utilizar rotas genéricas de aluno/Secretaria.

2. **Perfil e múltiplas funções**
   - `GET /funcionarios/me` retorna dados cadastrais, `displayName` (prioriza `socialName`), `registrationNumber` opcional (`null` quando ausente), `assignments` (múltiplas funções com `effectiveStatus`: `ACTIVE | FUTURE | EXPIRED | ENDED | ARCHIVED`) e `credential`.
   - Alterações cadastrais e de funções são administrativas (Secretaria). O funcionário solicita correções via suporte (`DATA`), nunca por `PATCH` direto no perfil.

3. **Carteirinha digital e validação pública por QR**
   - `GET /funcionarios/me/carteirinha` retorna `verificationUrl`, `qrcode`, `activeAssignments`, `approvedPhotoUrl` e `credential`.
   - O QR usa token opaco (`qrcode`), nunca RG, e-mail ou matrícula.
   - Validação pública em `GET /funcionarios/verificar/:qrcode` e `GET /funcionarios/verificar/:qrcode/foto`.
   - Se a carteirinha estiver inválida (`ACCOUNT_BLOCKED`, `NO_ACTIVE_ASSIGNMENT`, `PHOTO_PENDING`, etc.), a rota pública retorna `200 { valid: false, reasonCode, checkedAt }` sem foto nem dados pessoais. QR inexistente ou rotacionado retorna `404`.

4. **Foto do funcionário**
   - Limite de **200 KB** nos formatos **JPG, PNG ou WebP** (reutilizar compressão do portal do aluno).
   - `GET /funcionarios/me/foto`, `POST /funcionarios/me/foto` (`multipart` com `file`, `requestId`, `expectedVersion`), `DELETE /funcionarios/me/foto` e `GET /funcionarios/me/fotos/:photoId/conteudo`.
   - Enquanto uma nova foto está pendente de análise, a foto aprovada anterior continua ativa na carteirinha.
   - Em conflito `409 PHOTO_VERSION_CONFLICT` / `VERSION_CONFLICT`, recarregar o perfil antes de reenviar.

5. **Eventos, leitor de presença e QR permanente**
   - Leitura de eventos em `GET /events` e `GET /events/:id`.
   - Prévia e confirmação de presença em `GET /attendances/qr/:reference`, `POST /attendances/scan`, `POST /attendances/scan-reference`, `POST /attendances/location-challenge` e `GET /attendances/me`.
   - **Regras importantes**:
     - Funcionário elegível participa normalmente mesmo quando `visitorsAllowed = false`.
     - **Foto pendente não bloqueia presença em eventos**; apenas a carteirinha fica aguardando aprovação da foto.
     - Se todas as funções estiverem encerradas/vencidas, novas presenças são bloqueadas (`403 NO_ACTIVE_ASSIGNMENT`), mas o histórico e certificados já emitidos continuam acessíveis enquanto a conta estiver `ACTIVE`.

6. **Certificados e pesquisa de satisfação**
   - Listagem, detalhe e download de PDF em `GET /certificates/me`, `GET /certificates/:id` e `GET /certificates/:id/pdf`.
   - Verificação pública em `GET /certificates/verify/:code` (inclui `recipientType: "EMPLOYEE"` e `displayName`).
   - Certificados de funcionário sem matrícula omitem identificador funcional no PDF (nunca exibem RA fictício).
   - Pesquisa de satisfação anônima em `POST /public/events/:id/feedback` (não bloqueia download do PDF).

7. **Suporte**
   - Mesmas rotas do aluno: `POST /support/tickets`, `GET /support/tickets/me`, `GET /support/tickets/:id` e `POST /support/tickets/:id/messages|read|close|cancel|delete|reopen`.
   - Adequar textos da UI para o contexto do funcionário (ex.: `WAITING_STUDENT` no contrato significa aguardando resposta do titular).

8. **Informações institucionais e créditos**
   - `GET /public/institution`: retorna nome fixo da Fatec Itaquera e contatos configurados (`null` quando não disponíveis).
   - `GET /project-credits`: reutiliza o endpoint existente de créditos do projeto.

9. **Presença offline (PWA) e cache local**
   - O proxy do portal deve encaminhar `/api/attendances/employee-offline/*` para `/attendances/employee-offline/*` no backend preservando `Cookie`, `Set-Cookie` e `Origin`.
   - Fluxo: `POST /attendances/employee-offline/session` (com Bearer JWT) define cookie HttpOnly `event_employee_offline` (`Path=/api/attendances/employee-offline`, `SameSite=Strict`).
   - Envio/consulta/revogação usam apenas o cookie + `Origin` (`submit`, `status`, `revoke`). Não armazenar o JWT geral no Service Worker/IndexedDB.
   - Em eventos com GPS obrigatório (`locationEnabled = true`), o envio offline retorna `400 LOCATION_REQUIRED` e exige confirmação em primeiro plano com localização atual.
   - Cache visual offline da carteirinha deve guardar apenas projeção mínima (identidade visual, foto aprovada, funções, validade e `checkedAt`), sem RG, e-mail ou tokens sensíveis.

---

## Regras transversais de UI/integração

- **Nome de exibição**: usar sempre `displayName` (nome social quando definido).
- **Matrícula funcional**: opcional (`null` quando não cadastrada); nunca exigir ou fabricar RA.
- **Cargos não dão permissão administrativa**: cargo "Secretaria" ou "Coordenador" não dá acesso ao painel da Secretaria.
- **Concorrência (`409`)**: toda mutação com `expectedVersion` que retornar `409` exige recarregar os dados antes de tentar novamente.
- **Datas**: datas funcionais (`admissionDate`, `startsOn`, `validUntil`) vêm em `YYYY-MM-DD` com validade inclusiva no fuso `America/Sao_Paulo`.
