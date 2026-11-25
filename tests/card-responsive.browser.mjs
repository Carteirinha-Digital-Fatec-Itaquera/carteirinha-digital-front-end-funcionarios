import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { preview } from "vite";
import { chromium } from "playwright";
const base = "http://localhost:4298",
  api = "http://localhost:3099";
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../docs/contracts/fixtures/employees.fixture.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const image = await readFile(
  new URL("../public/perfil_default.png", import.meta.url),
);
const output = process.env.BATCH_EVIDENCE_DIR;
const profile = {
  ...fixture.multipleAssignmentsWithExpiry,
  name: "Maria Aparecida de Albuquerque e Souza Nascimento",
  displayName: "Maria Aparecida de Albuquerque e Souza Nascimento",
  socialName: null,
};
const photo = {
  id: "55555555-5555-4555-8555-555555555556",
  reviewStatus: "APPROVED",
  contentUrl:
    "/funcionarios/me/fotos/55555555-5555-4555-8555-555555555556/conteudo",
  reviewedAt: "2026-11-24T12:00:00Z",
};
const jobs = profile.assignments.map((job, index) => ({
  ...job,
  title: index
    ? "Coordenador de Desenvolvimento de Software Multiplataforma"
    : "Professor de Ensino Superior em Desenvolvimento de Software Multiplataforma",
}));
const server = await preview({ preview: { port: 4298, strictPort: true } });
let browser;
try {
  if (output) await mkdir(output, { recursive: true });
  browser = await chromium.launch();
  for (const width of [320, 375, 390, 430, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      serviceWorkers: "block",
    });
    context.setDefaultTimeout(15000);
    const state = { blocked: false, reason: null };
    await context.addInitScript(() =>
      sessionStorage.setItem(
        "carteirinha-funcionarios.session",
        "synthetic-responsive-session",
      ),
    );
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === base
        ? route.continue()
        : route.abort(),
    );
    await context.route(api + "/**", async (route) => {
      const req = route.request(),
        p = new URL(req.url()).pathname;
      const headers = {
        "access-control-allow-origin": base,
        "access-control-allow-headers": "authorization,content-type",
      };
      if (req.method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      const reply = (json) => route.fulfill({ json, headers });
      assert.equal(
        req.headers().authorization,
        "Bearer synthetic-responsive-session",
      );
      if (p === "/funcionarios/me")
        return reply({ ...profile, assignments: jobs });
      if (p === "/funcionarios/me/foto")
        return reply({
          approved: state.blocked ? null : photo,
          pending: state.blocked
            ? { ...photo, id: "pending", reviewStatus: "PENDING" }
            : null,
          latestAttempt: {
            photoId: "rejected-attempt",
            reviewStatus: "REJECTED",
            reviewReason: state.reason,
            reviewedAt: "2026-11-24T14:00:00Z",
          },
          version: 4,
        });
      if (p === "/funcionarios/me/carteirinha")
        return reply({
          ...profile,
          institutionName: "Fatec Itaquera — Professor Miguel Reale",
          activeAssignments: jobs,
          approvedPhotoId: state.blocked ? null : photo.id,
          approvedPhotoUrl: state.blocked ? null : photo.contentUrl,
          credential: {
            ...profile.credential,
            valid: !state.blocked,
            reasonCode: state.blocked ? "PHOTO_PENDING" : null,
          },
          verificationUrl: base + "/funcionarios/verificar/qr-fixture",
        });
      if (p.startsWith("/funcionarios/me/fotos/"))
        return route.fulfill({
          body: image,
          contentType: "image/png",
          headers,
        });
      if (p === "/support/tickets/me")
        return reply({ items: [], nextCursor: null });
      throw Error("Rota inesperada " + p);
    });
    const page = await context.newPage();
    const capture = async (name) => {
      assert(
        await page
          .locator("body")
          .evaluate((node) => node.scrollWidth <= innerWidth),
        "Sem overflow " + width,
      );
      if (output)
        await page.screenshot({
          path: join(resolve(output), name + "-" + width + ".png"),
          fullPage: true,
          animations: "disabled",
        });
    };
    await page.goto(base + "/carteirinha");
    const front = page.getByRole("article", { name: "Frente da carteirinha" });
    await front.waitFor();
    await page
      .getByRole("img", { name: "Fotografia do funcionário" })
      .evaluate((img) => img.decode());
    const rect = await front.boundingBox();
    assert(
      width <= 540 ? rect.height > rect.width : rect.width > rect.height,
      "Orientação correta em " + width,
    );
    assert.equal(
      await front.evaluate((node) => getComputedStyle(node).transform),
      "none",
    );
    for (const text of ["NOME:", "UNIDADE:", "FUNÇÃO:"])
      assert.equal(await front.getByText(text, { exact: true }).count(), 1);
    assert(
      (await front.innerText()).includes(
        profile.displayName.toLocaleUpperCase("pt-BR"),
      ),
    );
    const pic = await page
      .getByRole("img", { name: "Fotografia do funcionário" })
      .boundingBox();
    if (width <= 540) {
      const data = await front.locator("dl").boundingBox();
      assert(pic.y + pic.height <= data.y, "Foto acima dos dados");
    }
    await capture("carteirinha-frente");
    await page
      .getByRole("button", { name: "Mostrar verso da carteirinha" })
      .click();
    const back = page.getByRole("article", { name: "Verso da carteirinha" });
    await back.waitFor();
    const backBox = await back.boundingBox();
    assert(
      width <= 540
        ? backBox.height > backBox.width
        : backBox.width > backBox.height,
    );
    assert.equal(
      await back
        .locator("svg title")
        .filter({ hasText: "QR Code da carteirinha" })
        .count(),
      1,
    );
    if (width <= 540) {
      const unit = back.getByText("Fatec Itaquera — Professor Miguel Reale", {
        exact: true,
      });
      assert.equal(
        await unit.evaluate((node) => getComputedStyle(node).textTransform),
        "uppercase",
      );
    }
    await capture("carteirinha-verso");
    state.blocked = true;
    const refreshed = page.waitForResponse(
      (r) => r.url() === api + "/funcionarios/me/carteirinha",
    );
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await refreshed;
    await page.getByText("Foto em análise.", { exact: true }).first().waitFor();
    assert.equal(
      await back
        .locator("svg title")
        .filter({ hasText: "QR Code da carteirinha" })
        .count(),
      0,
    );
    if (width === 390 || width === 1440) {
      state.blocked = false;
      await page.goto(base);
      await page
        .getByRole("heading", { name: "Fotografia rejeitada" })
        .waitFor();
      const notice = page.getByRole("region", {
        name: "Situação da fotografia",
      });
      assert.equal(
        await notice.getByText("Motivo:", { exact: true }).count(),
        0,
      );
      assert(!(await notice.innerText()).includes("undefined"));
      await page
        .getByText(
          "A última foto enviada foi rejeitada. Sua foto aprovada anteriormente continua na carteirinha.",
          { exact: true },
        )
        .waitFor();
      await capture("rejeicao-sem-motivo");
      state.reason = "Imagem fora do enquadramento.";
      const refreshed = page.waitForResponse(
        (r) => r.url() === api + "/funcionarios/me/foto",
      );
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await refreshed;
      await notice
        .getByText("Imagem fora do enquadramento.", { exact: false })
        .waitFor();
      await capture("rejeicao-com-motivo");
    }
    await context.close();
    console.log(
      "Carteirinha " +
        width +
        ": orientação, textos, foto e QR aprovados com API simulada",
    );
  }
} finally {
  await browser?.close();
  await new Promise((done) => server.httpServer.close(done));
}
