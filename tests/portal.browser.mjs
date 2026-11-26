import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { preview } from "vite";
import { chromium } from "playwright";

const base = "http://localhost:4177";
const api = "http://localhost:3099";
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../docs/contracts/fixtures/employees.fixture.json",
      import.meta.url,
    ),
  ),
);
const people = [
  fixture.withoutRegistration,
  fixture.multipleAssignmentsWithExpiry,
];
const picture = await readFile(
  new URL("../public/perfil_default.png", import.meta.url),
);
const auth = "/autenticacao/funcionarios/";
const photoPath = "/funcionarios/me/foto";
const ticketPath = "/support/tickets";
const photoId = (number) =>
  "55555555-5555-4555-8555-" + String(number).padStart(12, "0");
const ticketId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const content = (id) => "/funcionarios/me/fotos/" + id + "/conteudo";
const approved = (index) => ({
  id: photoId(index),
  reviewStatus: "APPROVED",
  contentUrl: content(photoId(index)),
  reviewedAt: "2026-11-17T12:00:00Z",
});
const sessionStorageKey = "carteirinha-funcionarios.session";

async function installMock(context) {
  const state = {
    photos: [approved(1), approved(2)],
    pending: null,
    rejected: false,
    photoVersion: 3,
    conflict: true,
    ticketConflict: true,
    activated: false,
    revoked: new Set(),
    calls: [],
    ticket: null,
    messages: [],
    read: false,
    offline: false,
  };
  await context.route(api + "/**", async (route) => {
    const req = route.request();
    const { pathname: path } = new URL(req.url());
    const method = req.method();
    const headers = { "access-control-allow-origin": base };
    if (method === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          ...headers,
          "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
          "access-control-allow-headers": "authorization,content-type",
        },
      });
    state.calls.push([method, path]);
    const reply = (json, status = 200) =>
      route.fulfill({ json, status, headers });
    if (state.offline) return route.abort("failed");
    if (path.startsWith(auth) && !path.endsWith("alterar-senha")) {
      assert.equal(req.headers().authorization, undefined);
      const input = req.postDataJSON();
      if (path.endsWith("/login")) {
        if (state.loginGate) await state.loginGate;
        const index = input.email === "segunda@example.test" ? 1 : 0;
        if (
          !state.activated &&
          input.email === "pessoa@example.test" &&
          input.password === "FUN-FICTICIA"
        )
          return reply({
            firstAccessToken: "ativacao-ficticia-123",
            profileType: "employee",
            mustChangePassword: true,
            expiresAt: "2099-01-01T00:00:00Z",
          });
        if (
          input.password !== "senha-sintetica" &&
          !(state.activated && input.password === "nova-senha-sintetica")
        )
          return reply(
            { statusCode: 401, message: "Credenciais inválidas." },
            401,
          );
        return reply({
          token: "token-teste-" + index,
          profileType: "employee",
          mustChangePassword: false,
          expiresAt: "2099-01-01T00:00:00Z",
        });
      }
      if (path.endsWith("forgot-password")) {
        assert.deepEqual(input, { email: input.email });
        assert.ok(
          ["pessoa@example.test", "desconhecido@example.test"].includes(
            input.email,
          ),
        );
        return reply({ accepted: true }, 202);
      }
      const activation = path.endsWith("ativar");
      assert.ok(activation || path.endsWith("reset"));
      assert.deepEqual(input, {
        token: activation
          ? "ativacao-ficticia-123"
          : "redefinicao-ficticia-123",
        newPassword: "nova-senha-sintetica",
      });
      if (activation) state.activated = true;
      return reply(activation ? { activated: true } : { reset: true });
    }
    if (path.startsWith("/funcionarios/verificar/")) {
      assert.equal(req.headers().authorization, undefined);
      if (path.endsWith("/qr-teste"))
        return reply({ ...fixture.publicVerificationValid, photoUrl: null });
      if (path.endsWith("/qr-invalido"))
        return reply(fixture.publicVerificationBlocked);
      return reply(
        {
          statusCode: 404,
          code: "QR_NOT_FOUND",
          message: "QR Code não encontrado.",
        },
        404,
      );
    }
    if (path === "/public/institution")
      return reply({
        name: "Fatec Itaquera",
        shortName: "Fatec Itaquera",
        address: "Endereço fictício",
        city: "São Paulo",
        state: "SP",
        postalCode: null,
        phone: null,
        email: "teste@example.test",
        website: null,
      });
    if (path === "/project-credits") return reply({ contributors: [] });

    const token = req.headers().authorization;
    assert.match(token ?? "", /^Bearer token-teste-[01]$/);
    const index = Number(token.at(-1));
    if (state.revoked.has(index))
      return reply(
        {
          statusCode: 401,
          code: "SESSION_REVOKED",
          message: "Sessão revogada.",
        },
        401,
      );
    const profile = people[index];
    const activePhoto = state.photos[index];
    if (path === "/funcionarios/me")
      return reply({
        ...profile,
        credential: {
          ...profile.credential,
          reasonCode: state.rejected ? "PHOTO_REJECTED" : null,
        },
      });
    if (path === "/funcionarios/me/carteirinha")
      return reply({
        ...profile,
        institutionName: "Fatec Itaquera",
        activeAssignments: profile.assignments,
        credential: { ...profile.credential, valid: true },
        verificationUrl: base + "/funcionarios/verificar/qr-teste",
        approvedPhotoUrl: activePhoto?.contentUrl ?? null,
      });
    if (path === photoPath && method === "GET") {
      if (state.photoGate) await state.photoGate;
      return reply({
        approved: activePhoto,
        pending: state.pending,
        latestAttempt: state.rejected
          ? {
              photoId: photoId(99),
              reviewStatus: "REJECTED",
              reviewReason: "Enquadramento insuficiente.",
              reviewedAt: "2026-11-23T12:00:00Z",
            }
          : null,
        version: state.photoVersion,
      });
    }
    if (path === photoPath && method === "POST") {
      assert.match(
        req.headers()["content-type"],
        /^multipart\/form-data; boundary=/,
      );
      const body = req.postData();
      assert.match(body, /name="file"; filename="foto.jpg"/);
      assert.match(body, /name="requestId"/);
      const version = Number(
        body.match(/name="expectedVersion"\r\n\r\n(\d+)/)?.[1],
      );
      assert.equal(version, state.photoVersion);
      if (state.conflict) {
        state.conflict = false;
        state.photoVersion++;
        return reply(
          {
            statusCode: 409,
            code: "PHOTO_VERSION_CONFLICT",
            currentVersion: state.photoVersion,
          },
          409,
        );
      }
      const id = photoId(3);
      state.pending = {
        id,
        reviewStatus: "PENDING",
        processingState: "READY",
        contentUrl: content(id),
        reviewReason: null,
        createdAt: "2026-11-17T12:00:00Z",
      };
      state.photoVersion++;
      return reply(
        {
          photoId: id,
          reviewStatus: "PENDING",
          processingState: "READY",
          version: state.photoVersion,
        },
        201,
      );
    }
    if (path === photoPath && method === "DELETE") {
      assert.equal(req.postDataJSON().expectedVersion, state.photoVersion);
      assert.match(req.postDataJSON().requestId, /^[\da-f-]{36}$/);
      state.photos[index] = null;
      state.pending = null;
      return reply({ version: ++state.photoVersion });
    }
    if (path.startsWith("/funcionarios/me/fotos/")) {
      assert.ok(
        [activePhoto?.contentUrl, state.pending?.contentUrl].includes(path),
        "Só exibir a foto do titular",
      );
      return route.fulfill({
        body: picture,
        contentType: "image/png",
        headers,
      });
    }
    if (path === ticketPath + "/me")
      return reply({
        items:
          index === 0 && state.ticket
            ? [{ ...state.ticket, unread: !state.read }]
            : [],
        nextCursor: null,
      });
    if (path === ticketPath && method === "POST") {
      const input = req.postDataJSON();
      assert.equal(input.category, "DATA");
      assert.match(input.requestId, /^[\da-f-]{36}$/);
      assert(!("employeeId" in input || "eventId" in input));
      state.ticket = {
        id: ticketId,
        protocol: "SOL-TESTE",
        subject: input.subject,
        category: input.category,
        status: "OPEN",
        version: 1,
        createdAt: "2026-11-17T12:00:00Z",
      };
      state.read = false;
      return reply(state.ticket, 201);
    }
    if (path.startsWith(ticketPath + "/" + ticketId)) {
      if (index !== 0)
        return reply(
          { statusCode: 404, message: "Solicitação não encontrada." },
          404,
        );
      const action = path.split("/").at(-1);
      if (method === "GET")
        return reply({
          ticket: state.ticket,
          messages: state.messages,
          messageNextCursor: null,
        });
      const input = req.postDataJSON();
      if (action === "read") {
        assert.equal(input.version, state.ticket.version);
        state.read = true;
        return reply({ success: true }, 201);
      }
      if (action === "messages" && state.ticketConflict) {
        state.ticketConflict = false;
        state.ticket.version++;
      }
      if (input.expectedVersion !== state.ticket.version)
        return reply(
          { statusCode: 409, message: "Solicitação alterada." },
          409,
        );
      assert.match(input.requestId, /^[\da-f-]{36}$/);
      if (action === "messages")
        state.messages.push({
          id: "mensagem",
          authorRole: "EMPLOYEE",
          body: input.message,
          createdAt: state.ticket.createdAt,
        });
      else if (action === "close") state.ticket.status = "CLOSED";
      else if (action === "cancel" || action === "delete") {
        assert.equal(input.confirmed, true);
        assert.ok(input.reason.length >= 3);
        state.ticket.status = "CLOSED";
        if (action === "delete") {
          state.ticket = null;
          return reply({ success: true }, 201);
        }
      } else if (action === "reopen")
        return reply(
          { statusCode: 409, message: "Reabertura indisponível." },
          409,
        );
      else throw new Error("Ação inesperada: " + action);
      state.ticket.version++;
      return reply(state.ticket, 201);
    }
    throw new Error("Chamada inesperada: " + method + " " + path);
  });
  return state;
}

const evidence = process.env.PORTAL_TEST_SCREENSHOTS;
async function capture(page, name) {
  assert(
    await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
    "Sem rolagem horizontal em " + name,
  );
  if (evidence)
    await page.screenshot({
      path: join(evidence, name + ".png"),
      fullPage: true,
      animations: "disabled",
    });
}
const button = (page, name) => page.getByRole("button", { name, exact: true });
const heading = (page, name) =>
  page.getByRole("heading", { name, exact: typeof name === "string" });
async function login(page, index = 0, password = "senha-sintetica") {
  await page.goto(base + "/login");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(index === 0 ? "pessoa@example.test" : "segunda@example.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await button(page, "Entrar").click();
  if (password === "senha-sintetica")
    await heading(page, "Bem-vindo(a), " + people[index].displayName).waitFor();
}
async function logout(page) {
  await page.goto(base);
  await button(page, "Deslogar").click();
  await button(page, "Sair").click();
  await heading(page, "Login").waitFor();
  assert.equal(
    await page.evaluate(
      (key) => sessionStorage.getItem(key),
      sessionStorageKey,
    ),
    null,
  );
}

async function authFlows(page, state) {
  await page.goto(base + "/ativar-acesso?token=ativacao-ficticia-123");
  await page.getByText(/Inicie o primeiro acesso/).waitFor();
  assert.equal(await page.getByLabel("Nova senha", { exact: true }).count(), 0);
  for (const activation of [true, false]) {
    await page.goto(base + (activation ? "/login" : "/recuperar-senha"));
    await heading(page, activation ? "Login" : "Recuperar senha").waitFor();
    await page
      .getByLabel("E-mail", { exact: true })
      .fill("pessoa@example.test");
    if (activation) {
      const requests = state.calls.length;
      await page.getByLabel("Senha", { exact: true }).fill("FUN-FICTICIA");
      await button(page, "Entrar").click();
      await heading(page, "Criar senha pessoal").waitFor();
      assert(
        await page
          .locator("body")
          .evaluate((el) => el.scrollWidth <= innerWidth),
        "Primeira senha sem rolagem horizontal",
      );
      await capture(page, "criar-senha-" + page.viewportSize().width);
      assert.deepEqual(state.calls.slice(requests), [["POST", auth + "login"]]);
      assert.equal(
        await page.evaluate(
          (key) => sessionStorage.getItem(key),
          sessionStorageKey,
        ),
        null,
      );
    } else {
      await button(page, "Enviar link").click();
      await page.getByText(/receberá um link/).waitFor();
      await page.goto(base + "/redefinir-senha?token=redefinicao-ficticia-123");
    }
    await page.getByLabel("Nova senha", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).search, "");
    await page
      .getByLabel("Nova senha", { exact: true })
      .fill("nova-senha-sintetica");
    await page.getByLabel("Confirmar nova senha").fill("senha-diferente");
    const requests = state.calls.length;
    await button(page, "Salvar senha").click();
    await page.getByText(/confirme a mesma senha/).waitFor();
    assert.equal(state.calls.length, requests);
    await button(page, "Fechar").click();
    await page.getByLabel("Confirmar nova senha").fill("nova-senha-sintetica");
    await button(page, "Salvar senha").click();
    await heading(page, "Login").waitFor();
    await page
      .getByText(activation ? /Acesso ativado/ : /Senha redefinida/)
      .waitFor();
    if (activation) {
      const previousPhoto = state.photos[0];
      state.photos[0] = null;
      await page
        .getByLabel("E-mail", { exact: true })
        .fill("pessoa@example.test");
      await page
        .getByLabel("Senha", { exact: true })
        .fill("nova-senha-sintetica");
      await button(page, "Entrar").click();
      await page
        .getByRole("link", { name: "Envie uma foto para análise" })
        .waitFor();
      await page
        .getByRole("button", { name: "Meu Perfil", exact: true })
        .click();
      await heading(page, "Meu Perfil").waitFor();
      await page.getByText(people[0].email, { exact: true }).waitFor();
      assert.equal(await page.locator("input").count(), 0);
      await logout(page);
      state.photos[0] = previousPhoto;
    }
  }
}

async function photoFlows(page, state) {
  const notice = heading(page, "Foto aprovada");
  await notice.waitFor();
  await button(page, "Fechar aviso de foto aprovada").click();
  await notice.waitFor({ state: "hidden" });
  await page.reload();
  await page
    .getByRole("button", { name: "Carteirinha", exact: true })
    .waitFor();
  await page.waitForLoadState("networkidle");
  assert.equal(await notice.count(), 0);
  await logout(page);
  await login(page, 1);
  await notice.waitFor();
  await page.goto(base + "/suporte/" + ticketId);
  await page
    .getByRole("alert")
    .filter({ hasText: "Solicitação não encontrada." })
    .waitFor();
  await logout(page);
  await login(page);
  await page.goto(base + "/foto");
  await page
    .getByText("Foto aprovada na carteirinha.", { exact: true })
    .waitFor();
  let releasePhoto;
  state.photoGate = new Promise((resolve) => {
    releasePhoto = resolve;
  });
  await button(page, "Atualizar situação").click();
  await button(page, "Atualizando…").waitFor();
  assert(await button(page, "Atualizando…").isDisabled());
  await capture(page, "foto-atualizando");
  releasePhoto();
  state.photoGate = null;
  await button(page, "Atualizar situação").waitFor();
  await page.locator("input[type=file]:not([capture])").setInputFiles({
    name: "ficticia.png",
    mimeType: "image/png",
    buffer: picture,
  });
  await page.getByRole("img", { name: "Prévia da nova foto" }).waitFor();
  await button(page, "Confirmar Envio").click();
  const uploadRequests = state.calls.filter(
    ([method, path]) => method === "POST" && path === photoPath,
  ).length;
  await capture(page, "modal-substituir-foto");
  await button(page, "Cancelar").click();
  assert.equal(
    state.calls.filter(
      ([method, path]) => method === "POST" && path === photoPath,
    ).length,
    uploadRequests,
  );
  await button(page, "Confirmar Envio").click();
  await button(page, "Enviar nova foto").click();
  await page.getByText(/A situação da foto mudou/).waitFor();
  await button(page, "Confirmar Envio").click();
  await button(page, "Enviar nova foto").click();
  await page.getByText("Foto recebida e encaminhada para análise.").waitFor();
  await button(page, "OK").click();
  await page.getByText("Foto em análise.", { exact: true }).waitFor();
  await capture(page, "foto-em-analise-desktop");
  await page.goto(base);
  await heading(page, "Foto em análise").waitFor();
  state.pending = null;
  state.photos[0] = approved(3);
  await page.reload();
  await notice.waitFor();
  await page.goto(base + "/foto");
  await button(page, "Remover foto").click();
  const removalRequests = state.calls.filter(
    ([method]) => method === "DELETE",
  ).length;
  await capture(page, "modal-remover-foto");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Cancelar",
  );
  await button(page, "Cancelar").click();
  assert.equal(
    state.calls.filter(([method]) => method === "DELETE").length,
    removalRequests,
  );
  await button(page, "Remover foto").click();
  await button(page, "Remover").click();
  await page.getByText("Foto removida.", { exact: true }).waitFor();
  await button(page, "OK").click();
  state.rejected = true;
  await page.reload();
  await page.getByText("A foto não foi aprovada.", { exact: true }).waitFor();
  await page
    .getByText("Enquadramento insuficiente.", { exact: true })
    .waitFor();
  state.photos[0] = approved(4);
  await page.reload();
  await page
    .getByText(
      "A última foto enviada foi rejeitada. Sua foto aprovada anteriormente continua na carteirinha.",
      { exact: true },
    )
    .waitFor();
  await page
    .getByText("Enquadramento insuficiente.", { exact: true })
    .waitFor();
}

async function supportFlows(page, state) {
  await page.goto(base + "/suporte");
  await button(page, "Nova solicitação").click();
  await page.getByLabel(/Assunto/).fill("Correção cadastral fictícia");
  await page
    .getByLabel(/Descrição do problema/)
    .fill("Descrição sintética para validar o fluxo de atendimento.");
  await button(page, "Enviar solicitação").click();
  await button(page, "Ver solicitação").click();
  await heading(page, "Correção cadastral fictícia").waitFor();
  await page.waitForLoadState("networkidle");
  assert.ok(
    state.read ||
      state.calls.some(
        ([method, path]) => method === "POST" && path.endsWith("/read"),
      ),
  );
  await page
    .getByLabel("Sua mensagem", { exact: true })
    .fill("Mensagem fictícia.");
  await button(page, "Enviar mensagem").click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Solicitação alterada." })
    .waitFor();
  await button(page, "Enviar mensagem").click();
  await page.getByText("Mensagem fictícia.", { exact: true }).waitFor();
  await capture(page, "solicitacao-detalhe-desktop");
  state.ticket.status = "RESOLVED";
  await page.reload();
  const terminalInput = page.getByLabel("Mensagem para confirmar a solução");
  await terminalInput.fill("Solução confirmada.");
  await button(page, "Confirmar solução e encerrar").click();
  await button(page, "Confirmar solução e encerrar").waitFor({
    state: "hidden",
  });
  await page.getByRole("link", { name: "abra uma nova solicitação" }).waitFor();
  assert.equal(await button(page, "Reabrir solicitação").count(), 0);
  state.read = false;
  await page.goto(base);
  await page.getByRole("button", { name: /Solicitações: 1/ }).waitFor();
  await page.goto(base + "/suporte/" + ticketId);
  await heading(page, "Correção cadastral fictícia").waitFor();
  await page.waitForLoadState("networkidle");
  await page.goto(base);
  await button(page, "Solicitações").waitFor();
}

async function deleteTicket(page) {
  await page.goto(base + "/suporte/" + ticketId);
  await button(page, "Outras ações").click();
  await page
    .getByLabel("Motivo para cancelar ou excluir")
    .fill("Exclusão fictícia.");
  await button(page, "Excluir solicitação").click();
  await button(page, "Confirmar exclusão").click();
  await button(page, "Nova solicitação").waitFor();
}

const server = await preview({ preview: { port: 4177, strictPort: true } });
let browser;
try {
  if (evidence) await mkdir(evidence, { recursive: true });
  browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  );
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({
      viewport,
      serviceWorkers: "block",
    });
    context.setDefaultTimeout(10000);
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === base
        ? route.continue()
        : route.abort(),
    );
    const state = await installMock(context);
    const page = await context.newPage();
    await page.goto(base + "/carteirinha");
    await heading(page, "Login").waitFor();
    await capture(page, "login-" + viewport.width);
    await page.goto(base + "/recuperar-senha");
    await heading(page, "Recuperar senha").waitFor();
    await capture(page, "recuperacao-" + viewport.width);
    let releaseLogin;
    state.loginGate = new Promise((resolve) => {
      releaseLogin = resolve;
    });
    await page.goto(base + "/login");
    await page
      .getByLabel("E-mail", { exact: true })
      .fill("pessoa@example.test");
    await page.getByLabel("Senha", { exact: true }).fill("senha-incorreta");
    const beforeLogin = state.calls.length;
    await button(page, "Entrar").click();
    const loadingButton = page.locator('button[aria-busy="true"]');
    await loadingButton.waitFor();
    assert(await loadingButton.isDisabled());
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert(
      await loadingButton
        .locator("span[aria-hidden] span")
        .evaluateAll((nodes) =>
          nodes.every(
            (node) => getComputedStyle(node).animationName === "none",
          ),
        ),
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByLabel("Senha", { exact: true }).press("Enter");
    assert.equal(state.calls.length - beforeLogin, 1);
    await capture(page, "login-carregando-" + viewport.width);
    releaseLogin();
    state.loginGate = null;
    await page.getByText("Credenciais inválidas.", { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel("Senha", { exact: true }).inputValue(),
      "senha-incorreta",
    );
    await button(page, "Fechar").click();
    await authFlows(page, state);
    if (viewport.width === 1440) {
      await login(page, 0, "senha-incorreta");
      await page.getByText("Credenciais inválidas.", { exact: true }).waitFor();
    }
    await login(page);
    await heading(page, "Foto aprovada").waitFor();
    assert(
      await page.locator("body").evaluate((el) => el.scrollWidth <= innerWidth),
      "Home sem rolagem horizontal",
    );
    await capture(page, "home-" + viewport.width);
    await page.goto(base + "/carteirinha");
    await page
      .getByRole("button", { name: /Mostrar verso da carteirinha/ })
      .waitFor();
    await capture(page, "carteirinha-frente-" + viewport.width);
    await page
      .getByRole("button", { name: /Mostrar verso da carteirinha/ })
      .click();
    await page
      .getByRole("button", { name: /Mostrar frente da carteirinha/ })
      .waitFor();
    await capture(page, "carteirinha-verso-" + viewport.width);
    await page.goto(base + "/qr");
    await page
      .getByRole("link", { name: "Abrir página de validação" })
      .waitFor();
    await capture(page, "qr-" + viewport.width);
    await page.getByRole("link", { name: "Abrir página de validação" }).click();
    await page
      .getByText(fixture.publicVerificationValid.displayName, { exact: true })
      .waitFor();
    await capture(page, "validacao-publica-" + viewport.width);
    for (const [path, title, name] of [
      ["/meus-dados", "Meu Perfil", "meus-dados"],
      ["/foto", "Enviar fotografia", "foto"],
      ["/config", "Configurações", "configuracoes"],
      ["/unidade", "Informações da Unidade", "unidade"],
      ["/creditos", "Créditos do projeto", "creditos"],
      ["/suporte", "Minhas Solicitações", "solicitacoes"],
    ]) {
      await page.goto(base + path);
      await heading(page, title).waitFor();
      await page.waitForLoadState("networkidle");
      await capture(page, name + "-" + viewport.width);
      if (path === "/foto") {
        await button(page, "Remover foto").click();
        await page.getByRole("dialog", { name: "Remover foto?" }).waitFor();
        assert.equal(
          await page.evaluate(() => document.activeElement?.textContent),
          "Cancelar",
        );
        await capture(page, "modal-remover-foto-" + viewport.width);
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        const galleryInput = page.locator("input[type=file]:not([capture])");
        await galleryInput.setInputFiles({
          name: "ficticia.png",
          mimeType: "image/png",
          buffer: picture,
        });
        await page.getByRole("img", { name: "Prévia da nova foto" }).waitFor();
        await button(page, "Descartar prévia").click();
        await capture(page, "modal-descartar-previa-" + viewport.width);
        await button(page, "Cancelar").click();
        await page.getByRole("img", { name: "Prévia da nova foto" }).waitFor();
        await button(page, "Descartar prévia").click();
        await button(page, "Descartar").click();
        assert.equal(
          await page.getByRole("img", { name: "Prévia da nova foto" }).count(),
          0,
        );
      }
      if (path === "/unidade") {
        assert.equal(
          await page
            .getByRole("link", { name: "(11) 98787-7625", exact: true })
            .first()
            .getAttribute("href"),
          "https://wa.me/5511987877625",
        );
        await page.getByText("Seg - Sex, 8h às 18h", { exact: true }).waitFor();
        assert(
          (
            await page
              .getByRole("link", { name: /Endereço fictício/ })
              .getAttribute("href")
          ).startsWith("https://www.google.com/maps/search/"),
        );
      }
      if (path === "/config") {
        await page
          .getByRole("button", { name: /Acessibilidade Visual/ })
          .click();
        await page
          .getByRole("dialog", { name: "Acessibilidade visual" })
          .waitFor();
        await capture(page, "modal-acessibilidade-" + viewport.width);
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
      }
    }
    if (viewport.width === 1440) {
      await page.goto(base + "/funcionarios/verificar/qr-invalido");
      await page.getByText(/Carteirinha inválida/).waitFor();
      assert.equal(
        await page
          .getByText(fixture.publicVerificationValid.displayName, {
            exact: true,
          })
          .count(),
        0,
      );
      await page.goto(base + "/funcionarios/verificar/qr-inexistente");
      await page
        .getByText("QR Code não encontrado.", { exact: true })
        .waitFor();
      await page.goto(base + "/config");
      await heading(page, "Configurações").waitFor();
      await capture(page, "configuracoes-desktop");
      await page.goto(base + "/unidade");
      await page.getByText(/Endereço fictício/).waitFor();
      await capture(page, "unidade-desktop");
      await page.goto(base + "/creditos");
      await heading(page, "Créditos em organização").waitFor();
      await capture(page, "creditos-desktop");
      await supportFlows(page, state);
      await photoFlows(page, state);
      await deleteTicket(page);
      state.offline = true;
      await page.goto(base + "/carteirinha");
      await page.getByText(/Não foi possível conectar ao serviço/).waitFor();
      state.offline = false;
      await button(page, "Tentar novamente").click();
      await page
        .getByRole("button", { name: /Mostrar verso da carteirinha/ })
        .waitFor();
      state.revoked.add(0);
      await page.goto(base + "/carteirinha");
      await heading(page, "Login").waitFor();
      assert.equal(
        await page.evaluate(
          (key) => sessionStorage.getItem(key),
          sessionStorageKey,
        ),
        null,
      );
    } else await logout(page);
    for (const path of [
      "/eventos",
      "/eventos/scanner",
      "/certificados",
      "/visitantes",
      "/p/referencia",
    ]) {
      await page.goto(base + path);
      await heading(page, "Página indisponível").waitFor();
    }
    assert(
      !state.calls.some(([, path]) =>
        /attendance|events|certificates|\/aluno|\/estudantes/.test(path),
      ),
    );
    await context.close();
    console.log(
      "Playwright: " +
        viewport.width +
        "×" +
        viewport.height +
        " aprovado com API simulada.",
    );
  }
} finally {
  if (evidence && browser) {
    for (const ctx of browser.contexts())
      for (const openPage of ctx.pages()) {
        await openPage
          .screenshot({
            path: join(evidence, "ultima-tela.png"),
            fullPage: true,
          })
          .catch(() => {});
      }
  }
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
