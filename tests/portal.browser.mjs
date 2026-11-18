import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const base = 'http://localhost:4177';
const api = 'http://localhost:3099';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '4177', '--strictPort'], { stdio: 'inherit' });
const fixture = JSON.parse(await readFile(new URL('../docs/contracts/fixtures/employees.fixture.json', import.meta.url)));
const profile = fixture.withoutRegistration;
const verification = fixture.publicVerificationValid;
let browser;
try {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await fetch(base).then(r => r.ok).catch(() => false)) break;
    if (attempt === 79) throw new Error('O servidor de prévia não iniciou.');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {});
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const apiCalls = [];
    await context.route(api + '/**', async route => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      apiCalls.push(path);
      const headers = { 'access-control-allow-origin': base };
      if (req.method() === 'OPTIONS') {
        return route.fulfill({ status: 204, headers: { ...headers,
          'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS', 'access-control-allow-headers': 'authorization,content-type' } });
      }
      const reply = (json, status = 200) => route.fulfill({ json, status, headers });
      if (path === '/autenticacao/funcionarios/login') {
        assert.deepEqual(req.postDataJSON(), { email: 'pessoa@example.test', password: 'senha-sintetica' });
        return reply({ token: 'token-de-teste', profileType: 'employee', mustChangePassword: false });
      }
      if (path === '/funcionarios/verificar/qr-teste') {
        assert.equal(req.headers().authorization, undefined);
        return reply({ ...verification, photoUrl: null });
      }
      assert.equal(req.headers().authorization, 'Bearer token-de-teste');
      if (path === '/funcionarios/me') return reply(profile);
      if (path === '/funcionarios/me/foto') return reply({ approved: null, pending: null, version: profile.version });
      if (path === '/funcionarios/me/carteirinha') return reply({
        ...profile, institutionName: 'Fatec Itaquera', activeAssignments: profile.assignments,
        credential: { ...profile.credential, valid: true }, approvedPhotoUrl: null,
        verificationUrl: base + '/funcionarios/verificar/qr-teste',
      });
      if (path === '/support/tickets/me') return reply({ items: [{ id: 'ticket', unread: true }], nextCursor: null });
      throw new Error('Chamada inesperada: ' + path);
    });
    await page.goto(base + '/carteirinha');
    await page.getByRole('heading', { name: 'Login' }).waitFor();
    await page.getByLabel('E-mail').fill('pessoa@example.test');
    await page.getByLabel('Senha', { exact: true }).fill('senha-sintetica');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.getByRole('heading', { name: new RegExp(profile.displayName) }).waitFor();
    await page.getByRole('button', { name: /Solicitações: 1/ }).waitFor();
    assert.equal(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth), true);
    await page.reload();
    await page.getByRole('heading', { name: new RegExp(profile.displayName) }).waitFor();
    await page.getByRole('button', { name: 'Minha Carteirinha' }).click();
    await page.getByRole('button', { name: 'Mostrar verso da carteirinha' }).click();
    await page.getByRole('button', { name: 'Mostrar frente da carteirinha' }).waitFor();
    await page.goto(base + '/qr');
    await page.getByRole('link', { name: 'Abrir página de validação' }).click();
    await page.getByText(verification.displayName, { exact: true }).waitFor();
    await page.goto(base + '/');
    await page.getByRole('button', { name: 'Deslogar' }).click();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await page.getByRole('heading', { name: 'Login' }).waitFor();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('carteirinha-funcionarios.session')), null);
    await page.goto(base + '/eventos');
    await page.getByRole('heading', { name: 'Página indisponível' }).waitFor();
    assert(!apiCalls.some(path => /attendance|events|certificates/.test(path)));
    await context.close();
  }
  console.log('Portal verificado com API simulada em mobile e desktop.');
} finally {
  await browser?.close();
  server.kill();
}
