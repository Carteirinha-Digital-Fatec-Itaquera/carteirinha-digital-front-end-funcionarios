import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { preview } from "vite";
import { chromium } from "playwright";
const root = resolve(".");
const baseline = process.env.UX_BASELINE === "1";
const base = "http://localhost:4297",
  api = "http://localhost:3099";
const output = process.env.UX_EVIDENCE_DIR;
const fixture = JSON.parse(
  await readFile(
    join(root, "docs/contracts/fixtures/employees.fixture.json"),
    "utf8",
  ),
);
const picture = await readFile(join(root, "public/perfil_default.png"));
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const content = (id) => "/funcionarios/me/fotos/" + id + "/conteudo";
const photo = (id = "photo-a") => ({
  id,
  reviewStatus: "APPROVED",
  contentUrl: content(id),
  reviewedAt: "2026-11-24T12:00:00Z",
});
const server = await preview({
  build: {
    outDir: baseline ? resolve("../ux-baseline-portal-dist") : resolve("dist"),
  },
  preview: { port: 4297, strictPort: true },
});
let browser;
const metrics = [];
try {
  browser = await chromium.launch();
  if (output) await mkdir(output, { recursive: true });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    if (process.env.UX_WIDTH && viewport.width !== Number(process.env.UX_WIDTH))
      continue;
    const context = await browser.newContext({
      viewport,
      serviceWorkers: "block",
    });
    context.setDefaultTimeout(12000);
    const state = {
      calls: [],
      approved: photo(),
      pending: null,
      attempt: null,
      version: 4,
      slow: 150,
      fail: false,
      revoked: false,
      hold: null,
    };
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === base
        ? route.continue()
        : route.abort(),
    );
    await context.route(api + "/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        p = url.pathname,
        m = req.method();
      const headers = {
        "access-control-allow-origin": base,
        "access-control-allow-headers": "authorization,content-type",
        "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
      };
      const reply = (json, status = 200) =>
        route.fulfill({ json, status, headers });
      if (m === "OPTIONS") return route.fulfill({ status: 204, headers });
      state.calls.push({ p, m, time: Date.now() });
      if (p.endsWith("/login"))
        return reply({
          token:
            req.postDataJSON().email === "b@example.test"
              ? "synthetic-b"
              : "synthetic-a",
          profileType: "employee",
          mustChangePassword: false,
          expiresAt: "2099-01-01",
        });
      const b = req.headers().authorization === "Bearer synthetic-b";
      const person = {
        ...fixture.multipleAssignmentsWithExpiry,
        name: b ? "Pessoa B" : "João Silva",
        displayName: b ? "Pessoa B" : "João Silva",
        version: state.version,
      };
      if (state.revoked)
        return reply(
          { message: "Sessão revogada.", code: "SESSION_REVOKED" },
          401,
        );
      if (state.hold && p === "/funcionarios/me/foto") await state.hold;
      if (state.slow) await delay(state.slow);
      if (state.fail) return route.abort("failed");
      if (p === "/funcionarios/me") return reply(person);
      if (p === "/funcionarios/me/foto" && m === "GET")
        return reply({
          approved: b ? photo("photo-b") : state.approved,
          pending: state.pending,
          latestAttempt: state.attempt,
          version: state.version,
        });
      if (p === "/funcionarios/me/foto" && m === "DELETE") {
        state.approved = null;
        state.pending = null;
        state.attempt = null;
        return reply({ version: ++state.version });
      }
      if (p === "/funcionarios/me/foto" && m === "POST") {
        state.pending = { ...photo("pending-new"), reviewStatus: "PENDING" };
        state.attempt = {
          photoId: "pending-new",
          reviewStatus: "PENDING",
          reviewReason: null,
          reviewedAt: null,
        };
        return reply(
          {
            photoId: "pending-new",
            version: ++state.version,
            reviewStatus: "PENDING",
            processingState: "READY",
          },
          201,
        );
      }
      if (p === "/funcionarios/me/carteirinha")
        return reply({
          ...person,
          institutionName: "Fatec Itaquera — Professor Miguel Reale",
          activeAssignments: person.assignments,
          approvedPhotoUrl: state.approved?.contentUrl ?? null,
          credential: {
            ...person.credential,
            valid: !!state.approved,
            reasonCode: state.approved
              ? null
              : state.pending
                ? "PHOTO_PENDING"
                : "PHOTO_MISSING",
          },
          verificationUrl: base + "/funcionarios/verificar/qr-simulado",
        });
      if (p.startsWith("/funcionarios/me/fotos/"))
        return route.fulfill({
          body: picture,
          contentType: "image/png",
          headers,
        });
      if (p === "/support/tickets/me")
        return reply({ items: [], nextCursor: null });
      throw Error("Requisição inesperada " + m + " " + p);
    });
    const page = await context.newPage();
    const login = async (email) => {
      await page.goto(base + "/login");
      await page.getByLabel("E-mail", { exact: true }).fill(email);
      await page.getByLabel("Senha", { exact: true }).fill("senha-sintetica");
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await page.getByRole("heading", { name: /Bem-vindo/ }).waitFor();
    };
    const capture = async (name) => {
      if (!output) return;
      assert(
        await page
          .locator("body")
          .evaluate((el) => el.scrollWidth <= innerWidth),
        "Sem overflow em " + name,
      );
      await page.screenshot({
        path: join(output, name + "-" + viewport.width + ".png"),
        fullPage: true,
        animations: "disabled",
      });
    };
    await login("a@example.test");
    await page.locator('img[src^="blob:"]').first().waitFor();
    await page.waitForLoadState("networkidle");
    const initial = state.calls.filter(
      (x) => x.p === "/funcionarios/me" || x.p === "/funcionarios/me/foto",
    ).length;
    if (!baseline)
      await page.evaluate(() => {
        window.uxFrames = [];
        new MutationObserver(() => {
          const name = document.querySelector("h1")?.textContent || "";
          if (!name.startsWith("Bem-vindo")) return;
          const image = document.querySelector('img[src^="blob:"]');
          window.uxFrames.push({
            name,
            photo: !!image && getComputedStyle(image).visibility === "visible",
          });
        }).observe(document.body, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["src", "class"],
        });
      });
    const before = state.calls.length;
    const start = Date.now();
    await page.getByRole("button", { name: "Meu Perfil", exact: true }).click();
    await page
      .getByRole("heading", {
        name: baseline ? "Meus dados" : "Meu Perfil",
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("link", { name: "Voltar ao menu", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Bem-vindo(a), João Silva", exact: true })
      .waitFor();
    await page.locator('img[src^="blob:"]').first().waitFor();
    await page.waitForLoadState("networkidle");
    const requests = state.calls
      .slice(before)
      .filter(
        (x) =>
          x.p === "/funcionarios/me" ||
          x.p === "/funcionarios/me/foto" ||
          x.p.startsWith("/funcionarios/me/fotos/"),
      ).length;
    metrics.push({
      viewport: viewport.width,
      mode: baseline ? "main" : "branch",
      initialProfileAndPhoto: initial,
      navigationPrivateRequests: requests,
      navigationMs: Date.now() - start,
    });
    console.log("Medição", JSON.stringify(metrics.at(-1)));
    if (output)
      await writeFile(
        join(output, baseline ? "metricas-main.json" : "metricas-branch.json"),
        JSON.stringify(metrics, null, 2),
      );
    state.slow = 0;
    if (baseline) {
      await context.close();
      continue;
    }
    const frames = await page.evaluate(() => window.uxFrames);
    assert(
      frames.length > 0 &&
        frames.every(
          (frame) => frame.name.includes("João Silva") && frame.photo,
        ),
      "Sem flicker de nome ou foto no retorno",
    );
    assert.equal(initial, 2, "Perfil deduplicado com o guard");
    assert.equal(
      requests,
      0,
      "Sem recarregar perfil/foto/blob numa navegação recente",
    );
    await capture("home-estavel");
    await page
      .getByRole("button", { name: "Carteirinha", exact: true })
      .click();
    await page.getByText("NOME:", { exact: true }).waitFor();
    const front = page.getByRole("article", { name: "Frente da carteirinha" });
    assert.match(await front.innerText(), /JOÃO SILVA/);
    assert.match(await front.innerText(), /COORDENADOR DE DSM/);
    assert.equal(
      await front
        .locator('img[alt="Fotografia do funcionário"]')
        .evaluate((el) => getComputedStyle(el).objectFit),
      "contain",
    );
    await capture("carteirinha-frente");
    await page
      .getByRole("button", { name: /Mostrar verso da carteirinha/ })
      .click();
    await page.getByRole("article", { name: "Verso da carteirinha" }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: /Mostrar frente da carteirinha/ })
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      await page
        .locator("svg title")
        .filter({ hasText: "QR Code da carteirinha" })
        .count(),
      1,
    );
    await capture("carteirinha-verso");
    await page.waitForFunction(
      () => !document.querySelector('[data-turning="true"]'),
    );
    await page
      .getByRole("button", { name: /Mostrar frente da carteirinha/ })
      .focus();
    await page.keyboard.press("Enter");
    await front.waitFor();
    await page.getByRole("button", { name: "Voltar ao menu" }).click();
    await page.getByRole("heading", { name: /João Silva/ }).waitFor();
    await page
      .getByRole("button", { name: "Enviar Foto", exact: true })
      .click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page
      .getByRole("heading", { name: "Enviar fotografia", exact: true })
      .waitFor();
    state.slow = 600;
    await page
      .getByRole("button", { name: "Atualizar situação", exact: true })
      .click();
    await page
      .getByRole("link", { name: "Voltar ao menu", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Bem-vindo(a), João Silva", exact: true })
      .waitFor();
    assert.match(
      await page.getByRole("heading", { level: 1 }).innerText(),
      /João Silva/,
    );
    assert.equal(await page.locator('img[src^="blob:"]').count(), 1);
    await page.waitForLoadState("networkidle");
    state.slow = 0;
    const refresh = async () => {
      await page
        .getByRole("heading", { name: "Bem-vindo(a), João Silva", exact: true })
        .waitFor();
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const finished = page.waitForEvent(
        state.fail ? "requestfailed" : "requestfinished",
        {
          predicate: (request) =>
            request.url() === api + "/funcionarios/me/foto",
        },
      );
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await finished;
    };
    state.attempt = {
      photoId: "rejected-1",
      reviewStatus: "REJECTED",
      reviewReason: "Enquadramento insuficiente.",
      reviewedAt: "2026-11-24T12:00:00Z",
    };
    await refresh();
    await page.getByRole("heading", { name: "Fotografia rejeitada" }).waitFor();
    await page
      .getByText("Enquadramento insuficiente.", { exact: false })
      .waitFor();
    await capture("home-rejeicao");
    await page
      .getByRole("button", { name: "Fechar aviso de fotografia rejeitada" })
      .click();
    await page.getByRole("button", { name: "Meu Perfil", exact: true }).click();
    await page
      .getByRole("link", { name: "Voltar ao menu", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Bem-vindo(a), João Silva", exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("heading", { name: "Fotografia rejeitada" }).count(),
      0,
    );
    state.attempt = {
      ...state.attempt,
      photoId: "rejected-2",
      reviewedAt: "2026-11-24T12:10:00Z",
    };
    await refresh();
    await page.getByRole("heading", { name: "Fotografia rejeitada" }).waitFor();
    state.approved = null;
    await refresh();
    await page
      .getByText(
        "A última foto enviada foi rejeitada. Sua foto aprovada anteriormente continua na carteirinha.",
        { exact: true },
      )
      .waitFor({ state: "hidden" });
    assert.equal(
      await page
        .getByText(
          "A última foto enviada foi rejeitada. Sua foto aprovada anteriormente continua na carteirinha.",
          { exact: true },
        )
        .count(),
      0,
    );
    state.pending = { ...photo("pending-first"), reviewStatus: "PENDING" };
    state.attempt = {
      photoId: "pending-first",
      reviewStatus: "PENDING",
      reviewReason: null,
      reviewedAt: null,
    };
    await refresh();
    await page.getByRole("heading", { name: "Foto em análise" }).waitFor();
    await page
      .getByRole("button", { name: "Carteirinha", exact: true })
      .click();
    await page
      .getByRole("button", { name: /Mostrar verso da carteirinha/ })
      .click();
    assert.equal(
      await page
        .locator("svg title")
        .filter({ hasText: "QR Code da carteirinha" })
        .count(),
      0,
    );
    await page.getByRole("button", { name: "Voltar ao menu" }).click();
    state.approved = photo("approved-new");
    state.pending = null;
    state.attempt = null;
    await refresh();
    await page.getByRole("heading", { name: "Foto aprovada" }).waitFor();
    state.fail = true;
    await refresh();
    assert.match(
      await page.getByRole("heading", { level: 1 }).innerText(),
      /João Silva/,
    );
    assert.equal(await page.locator('img[src^="blob:"]').count(), 1);
    await capture("home-api-indisponivel");
    await page
      .getByRole("button", { name: "Carteirinha", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Carteirinha", exact: true })
      .waitFor();
    await page
      .getByRole("alert")
      .filter({ hasText: /Não foi possível conectar/ })
      .waitFor();
    assert.equal(
      await page
        .locator("svg title")
        .filter({ hasText: "QR Code da carteirinha" })
        .count(),
      0,
    );
    state.fail = false;
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await page
      .getByRole("button", { name: /Mostrar verso da carteirinha/ })
      .waitFor();
    await page.getByRole("button", { name: "Voltar ao menu" }).click();
    await page.getByRole("button", { name: "Deslogar" }).click();
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await page.getByRole("heading", { name: "Login", exact: true }).waitFor();
    await login("b@example.test");
    await page
      .getByRole("heading", { name: "Bem-vindo(a), Pessoa B", exact: true })
      .waitFor();
    assert.equal(await page.getByText(/João Silva/).count(), 0);
    await page.locator('img[src^="blob:"]').first().waitFor();
    state.revoked = true;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.getByRole("heading", { name: "Login", exact: true }).waitFor();
    await context.close();
    console.log("UX Portal " + viewport.width + ": aprovado com API simulada");
  }
  if (output)
    await writeFile(
      join(output, baseline ? "metricas-main.json" : "metricas-branch.json"),
      JSON.stringify(metrics, null, 2),
    );
  console.log(JSON.stringify(metrics));
} finally {
  await browser?.close();
  await new Promise((done) => server.httpServer.close(done));
}
