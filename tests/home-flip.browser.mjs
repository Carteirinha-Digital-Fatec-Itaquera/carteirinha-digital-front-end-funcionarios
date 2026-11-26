import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { preview } from "vite";
import { chromium } from "playwright";
const base = "http://localhost:4307",
  api = "http://localhost:3099";
const output = process.env.FLIP_EVIDENCE_DIR;
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../docs/contracts/fixtures/employees.fixture.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const picture = await readFile(
  new URL("../public/perfil_default.png", import.meta.url),
);
const profile = {
  ...fixture.multipleAssignmentsWithExpiry,
  displayName: "Marina Aparecida de Souza",
  name: "Marina Aparecida de Souza",
  socialName: null,
};
const photoId = profile.photo.approvedPhotoId;
const photoUrl = "/funcionarios/me/fotos/" + photoId + "/conteudo";
const server = await preview({ preview: { port: 4307, strictPort: true } });
let browser;
const wait = async (page) =>
  page.waitForFunction(() => !document.querySelector('[data-turning="true"]'));
async function mock(context, state) {
  await context.route("**/*", (r) =>
    new URL(r.request().url()).origin === base ? r.continue() : r.abort(),
  );
  await context.route(api + "/**", async (route) => {
    const req = route.request(),
      p = new URL(req.url()).pathname;
    const headers = {
      "access-control-allow-origin": base,
      "access-control-allow-headers": "authorization,content-type",
      "access-control-allow-methods": "GET,OPTIONS",
    };
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    state.calls.push({ p, method: req.method() });
    assert.equal(
      req.method(),
      "GET",
      "Esta validação não envia dados de teste",
    );
    assert.equal(req.headers().authorization, "Bearer synthetic-home-flip");
    if (state.revoked)
      return route.fulfill({
        status: 401,
        json: { code: "SESSION_REVOKED", message: "Sessão revogada." },
        headers,
      });
    const reply = (json) => route.fulfill({ json, headers });
    const person = { ...profile, rg: state.rg };
    if (p === "/funcionarios/me") return reply(person);
    if (p === "/funcionarios/me/foto")
      return reply({
        approved: {
          id: photoId,
          contentUrl: photoUrl,
          reviewStatus: "APPROVED",
          reviewedAt: "2026-11-26T12:00:00Z",
        },
        pending: null,
        latestAttempt: null,
        version: 4,
      });
    if (p === photoUrl)
      return route.fulfill({
        body: picture,
        contentType: "image/png",
        headers,
      });
    if (p === "/funcionarios/me/carteirinha") {
      if (state.cardOffline) return route.abort("failed");
      const card = {
        ...person,
        institutionName: "Fatec Itaquera — Professor Miguel Reale",
        activeAssignments: person.assignments,
        approvedPhotoUrl: photoUrl,
        credential: {
          ...person.credential,
          valid: !state.reason,
          reasonCode: state.reason,
        },
        verificationUrl: state.invalidUrl
          ? "javascript:alert(1)"
          : base + "/funcionarios/verificar/qr-sintetico",
      };
      delete card.rg;
      return reply(card);
    }
    if (p === "/support/tickets/me")
      return reply({
        items: [
          { id: "unread-a", unread: true },
          { id: "unread-b", unread: true },
        ],
        nextCursor: null,
      });
    throw Error("Endpoint inesperado " + p);
  });
}
try {
  browser = await chromium.launch();
  if (output) await mkdir(output, { recursive: true });
  for (const width of [320, 375, 390, 430, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      serviceWorkers: "block",
      hasTouch: width <= 430,
      isMobile: width <= 430,
    });
    await context.addInitScript(() =>
      sessionStorage.setItem(
        "carteirinha-funcionarios.session",
        "synthetic-home-flip",
      ),
    );
    const state = {
      rg: profile.rg,
      reason: null,
      invalidUrl: false,
      cardOffline: false,
      revoked: false,
      calls: [],
    };
    await mock(context, state);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const capture = async (name) => {
      assert(
        await page.locator("body").evaluate((e) => e.scrollWidth <= innerWidth),
        "Sem overflow em " + name,
      );
      if (output)
        await page.screenshot({
          path: join(resolve(output), name + "-" + width + ".png"),
          fullPage: true,
          animations: "disabled",
        });
    };
    await page.goto(base);
    await page
      .getByRole("heading", {
        name: "Bem-vindo(a), " + profile.displayName,
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", { name: "Ampliar foto", exact: true })
      .locator('img[src^="blob:"]')
      .waitFor();
    const mainCard = page.getByRole("button", {
      name: "Carteirinha",
      exact: true,
    });
    const cards = mainCard.locator("..").getByRole("button");
    const labels = [
      "Carteirinha",
      "Enviar Foto",
      "QR Code",
      "Meu Perfil",
      "Solicitações",
      "Configurações",
      "Informações da Unidade",
    ];
    assert.deepEqual(await cards.locator("p").allTextContents(), labels);
    assert.equal(
      await page.getByRole("link", { name: "Conferir meus dados" }).count(),
      0,
    );
    await page
      .getByRole("button", {
        name: /Solicitações: 2 com atualizações não lidas/,
      })
      .waitFor();
    const boxes = await Promise.all(
      labels.map((_, i) => cards.nth(i).boundingBox()),
    );
    assert(
      boxes[0].width > boxes[1].width * 1.8,
      "Carteirinha ocupa a primeira fileira",
    );
    for (const [left, right] of [
      [1, 2],
      [3, 4],
      [5, 6],
    ]) {
      assert(
        Math.abs(boxes[left].y - boxes[right].y) < 2,
        "Par na mesma fileira",
      );
      assert(boxes[left].x < boxes[right].x);
      assert(Math.abs(boxes[left].width - boxes[right].width) < 2);
      assert(boxes[left].height >= 44);
    }
    assert(
      Math.abs(boxes[1].x - boxes[3].x) < 2 && boxes[3].y > boxes[1].y,
      "Meu Perfil abaixo de Enviar Foto",
    );
    await capture("home");
    await page.waitForLoadState("networkidle");
    const countProfile = () =>
      state.calls.filter((x) => x.p === "/funcionarios/me").length;
    const countPhoto = () => state.calls.filter((x) => x.p === photoUrl).length;
    const before = [countProfile(), countPhoto()];
    await page.getByRole("button", { name: "Meu Perfil", exact: true }).click();
    assert.equal(new URL(page.url()).pathname, "/meus-dados");
    await page
      .getByRole("heading", { name: "Meu Perfil", exact: true })
      .waitFor();
    await page.getByText(profile.email, { exact: true }).waitFor();
    assert.equal(
      await page.locator("input").count(),
      0,
      "Perfil permanece consulta",
    );
    await page
      .getByRole("link", { name: "Voltar ao menu", exact: true })
      .click();
    await page
      .getByRole("heading", {
        name: "Bem-vindo(a), " + profile.displayName,
        exact: true,
      })
      .waitFor();
    await page.waitForLoadState("networkidle");
    assert.deepEqual(
      [countProfile(), countPhoto()],
      before,
      "Navegação mantém perfil e blob no cache",
    );
    await mainCard.click();
    const flip = page.getByRole("button", { name: /Mostrar.*carteirinha/ });
    const front = page.getByRole("article", {
      name: "Frente da carteirinha",
      exact: true,
    });
    const back = page.getByRole("article", {
      name: "Verso da carteirinha",
      exact: true,
    });
    await front.waitFor();
    assert.equal(
      await page
        .getByRole("button", {
          name: "Mostrar frente da carteirinha",
          exact: true,
        })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", {
          name: "Mostrar verso da carteirinha",
          exact: true,
        })
        .count(),
      0,
    );
    await page
      .getByText("Toque para virar a carteirinha", { exact: true })
      .waitFor();
    assert.equal(await front.getByText(/Governo do Estado/).count(), 0);
    const logos = front.locator('img:not([alt="Fotografia do funcionário"])');
    assert.equal(await logos.count(), 2);
    for (const image of await logos.all())
      assert.equal(
        await image.evaluate((e) => getComputedStyle(e).objectFit),
        "contain",
      );
    assert.match(
      await front.innerText(),
      new RegExp(profile.displayName.toLocaleUpperCase("pt-BR")),
    );
    const data = await front.locator("dl").boundingBox();
    const image = await front
      .getByRole("img", { name: "Fotografia do funcionário" })
      .boundingBox();
    assert(
      image.x >= data.x + data.width - 2,
      "Fotografia permanece ao lado dos dados, sem layout vertical",
    );
    assert.equal(
      await flip.evaluate((e) => getComputedStyle(e.parentElement).transform),
      "none",
    );
    await capture("carteirinha-frente");
    const callsBeforeFlip = state.calls.length;
    if (width <= 430) await flip.tap();
    else await flip.click();
    await back.waitFor();
    await wait(page);
    const rg = () =>
      back
        .locator("dt")
        .filter({ hasText: /^RG:$/ })
        .locator("..")
        .locator("dd");
    assert.equal(await rg().innerText(), profile.rg);
    assert.equal(
      await back.getByText("Carteirinha válida", { exact: true }).count(),
      0,
    );
    assert.match(await back.innerText(), /004512-A/);
    assert.match(await back.innerText(), /01\/08\/2023/);
    assert.match(await back.innerText(), /31\/12\/2026/);
    assert.equal(
      await back
        .locator("svg title")
        .filter({ hasText: "QR Code da carteirinha" })
        .count(),
      1,
    );
    await capture("carteirinha-verso");
    await flip.focus();
    await page.keyboard.press("Space");
    await front.waitFor();
    await wait(page);
    await page.keyboard.press("Enter");
    await back.waitFor();
    await wait(page);
    assert.equal(
      state.calls.length,
      callsBeforeFlip,
      "Virar não adiciona chamadas à API",
    );
    if (width === 390 || width === 1440) {
      const refresh = async (pathname = "/funcionarios/me/carteirinha") => {
        const response = page.waitForEvent(
          state.cardOffline ? "requestfailed" : "requestfinished",
          { predicate: (r) => r.url() === api + pathname },
        );
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await response;
      };
      for (const missing of [null, undefined, "", "   "]) {
        state.rg = missing;
        await refresh("/funcionarios/me");
        await rg().filter({ hasText: "Não informado" }).waitFor();
        assert.equal(await rg().innerText(), "Não informado");
      }
      await capture("carteirinha-rg-nao-informado");
      for (const code of [
        "PHOTO_PENDING",
        "PHOTO_REJECTED",
        "ACCOUNT_BLOCKED",
        "ACCOUNT_ARCHIVED",
        "NO_ACTIVE_ASSIGNMENT",
        "ADMISSION_FUTURE",
      ]) {
        state.reason = code;
        await refresh();
        await back.getByText("QR indisponível", { exact: true }).waitFor();
        assert.equal(
          await back.locator("svg title").count(),
          0,
          "QR bloqueado: " + code,
        );
      }
      await capture("carteirinha-bloqueada");
      state.reason = null;
      state.invalidUrl = true;
      await refresh();
      await back.getByText("QR indisponível", { exact: true }).waitFor();
      assert.equal(
        await back.locator("svg title").count(),
        0,
        "URL não segura não emite QR",
      );
      state.invalidUrl = false;
      state.cardOffline = true;
      await refresh();
      await page
        .getByRole("alert")
        .filter({ hasText: /Não foi possível conectar/ })
        .waitFor();
      assert.equal(
        await back.locator("svg title").count(),
        0,
        "API indisponível não reapresenta QR antigo",
      );
      state.cardOffline = false;
      state.revoked = true;
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.getByRole("heading", { name: "Login", exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() =>
          sessionStorage.getItem("carteirinha-funcionarios.session"),
        ),
        null,
      );
    }
    assert.deepEqual(errors, []);
    assert(
      !state.calls.some((x) =>
        /aluno|estudante|event|attendance|certificate/.test(x.p),
      ),
    );
    await context.close();
    console.log(
      "Home + carteirinha flip " +
        width +
        ": ordem, perfil, cache, apresentação e elegibilidade aprovados com API simulada",
    );
  }
  const anonymous = await browser.newContext({ serviceWorkers: "block" });
  const page = await anonymous.newPage();
  await page.goto(base + "/carteirinha");
  await page.getByRole("heading", { name: "Login", exact: true }).waitFor();
  await anonymous.close();
  console.log("Rota protegida direta sem sessão: login preservado");
} finally {
  await browser?.close();
  await new Promise((done) => server.httpServer.close(done));
}
