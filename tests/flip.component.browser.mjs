import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";
const base = "http://127.0.0.1:4308";
const server = await createServer({
  server: { host: "127.0.0.1", port: 4308, strictPort: true },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  for (const reduced of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === base
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(120000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/tests/components/flip.html", {
      waitUntil: "domcontentloaded",
    });
    const flip = page.getByRole("button", { name: /Mostrar.*carteirinha/ });
    const front = page.getByRole("article", { name: "Face de teste frontal" });
    const back = page.getByRole("article", { name: "Face de teste traseira" });
    const settled = () =>
      page.waitForFunction(
        () => !document.querySelector('[data-turning="true"]'),
      );
    await front.waitFor();
    assert.equal(
      await back.count(),
      0,
      "Face traseira fora da árvore acessível",
    );
    assert.equal(await flip.getAttribute("aria-pressed"), "false");
    const css = await flip.evaluate((element) => ({
      perspective: getComputedStyle(element.parentElement).perspective,
      duration: getComputedStyle(element.parentElement.firstElementChild)
        .transitionDuration,
      style: getComputedStyle(element.parentElement.firstElementChild)
        .transformStyle,
    }));
    assert.equal(css.perspective, "2000px");
    assert.equal(css.style, "preserve-3d");
    assert.equal(css.duration, reduced ? "0s" : "0.7s");
    await flip.click();
    await back.waitFor();
    if (!reduced) {
      await page.waitForFunction(() => {
        const button = document.querySelector("button[data-turning]");
        const matrix = new DOMMatrixReadOnly(
          getComputedStyle(button.parentElement.firstElementChild).transform,
        );
        return (
          matrix.m11 > -0.99 &&
          matrix.m11 < 0.99 &&
          Math.abs(matrix.m13) > 0.05 &&
          Math.abs(matrix.m12) < 0.001
        );
      });
    }
    assert.equal(
      await page
        .getByRole("article", {
          name: "Face de teste frontal",
          includeHidden: true,
        })
        .locator("..")
        .evaluate((node) => getComputedStyle(node).backfaceVisibility),
      "hidden",
    );
    assert.equal(
      await back
        .locator("..")
        .evaluate((node) => getComputedStyle(node).backfaceVisibility),
      "hidden",
    );
    assert.equal(await front.count(), 0);
    assert.equal(await back.locator("..").getAttribute("inert"), null);
    assert.equal(
      await page
        .getByText("Frente sintética")
        .locator("..")
        .getAttribute("aria-hidden"),
      "true",
    );
    await settled();
    await flip.focus();
    await page.keyboard.press("Space");
    await front.waitFor();
    await settled();
    assert.equal(
      await flip.evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Enter");
    await back.waitFor();
    await settled();
    await flip.click();
    await front.waitFor();
    await settled();
    if (!reduced) {
      await flip.evaluate((el) => {
        el.click();
        el.click();
        el.click();
      });
      await back.waitFor();
      assert.equal(
        await flip.getAttribute("aria-pressed"),
        "true",
        "Repetição durante giro não enfileira movimentos",
      );
      await settled();
      await page.keyboard.down("Enter");
      await page.keyboard.down("Enter");
      await page.keyboard.up("Enter");
      await front.waitFor();
      await settled();
      await flip.click();
      await page.getByRole("button", { name: "Recriar componente" }).click();
      await front.waitFor();
      await page.waitForTimeout(850);
      assert.equal(
        await flip.getAttribute("aria-pressed"),
        "false",
        "Remontagem não recebe timer antigo",
      );
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      "CardFlip isolado: clique, teclado, faces, foco, repetição e reduced-motion=" +
        reduced +
        " aprovados",
    );
  }
  const touch = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await touch.route("**/*", (route) =>
    new URL(route.request().url()).origin === base
      ? route.continue()
      : route.abort(),
  );
  const page = await touch.newPage();
  page.setDefaultNavigationTimeout(120000);
  await page.goto(base + "/tests/components/flip.html", {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("button", { name: /Mostrar verso/ }).tap();
  await page.getByRole("article", { name: "Face de teste traseira" }).waitFor();
  await touch.close();
  console.log("CardFlip isolado: toque aprovado");
} finally {
  await browser?.close();
  await server.close();
}
