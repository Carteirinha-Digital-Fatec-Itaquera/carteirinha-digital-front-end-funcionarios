# Testar Home, Meu Perfil e flip no VS Code

Branch: feature/issue-12-home-perfil-flip. Entrega em PR Draft da issue #12; sem merge ou deploy. A carteirinha vertical do PR #11 está cancelada e não integra esta branch.

## Abrir o código

Em uma pasta de sua escolha, clone a branch publicada e abra no VS Code:

~~~powershell
git clone --branch feature/issue-12-home-perfil-flip --single-branch https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-funcionarios.git funcionarios-home-flip
code funcionarios-home-flip
npm ci
npx playwright install chromium
~~~

Se já possui um clone, use git fetch origin e git switch feature/issue-12-home-perfil-flip. Não reutilize a branch cancelada.

## Validação automática sem backend

Os testes de navegador simulam a API local e usam contas, fotos e dados fictícios. Não enviam fixtures para produção. Defina a base da API antes do build, porque o Vite a incorpora no bundle:

~~~powershell
$env:VITE_API_BASE_URL='http://localhost:3099'
$env:FLIP_EVIDENCE_DIR=Join-Path (Get-Location) 'evidencias-home-flip'
npm run lint
npm run build
npm run test:cache
npm run test:components
npm run test:home-flip
npm run test:browser
npm run test:ux
~~~

As portas locais utilizadas são 4308 (componente isolado), 4307 (Home/flip), 4177 (regressão do Portal) e 4297 (UX/cache). Execute um comando por vez. PLAYWRIGHT_BROWSERS_PATH pode apontar para um cache local de Chromium existente.

O harness em tests/components/flip.html é servido apenas pelo Vite de desenvolvimento durante o teste de componente; não é rota do Portal nem entrada do build de produção. Não foram adicionadas bibliotecas de teste.

## Validação manual

Para navegar manualmente, copie .env.example para .env.local, configure VITE_API_BASE_URL para sua API local/de testes e use uma conta fictícia desse ambiente. Remova a variável VITE_API_BASE_URL do terminal ou ajuste-a para a mesma API antes de npm run dev. Os mocks são ativados somente pelos scripts Playwright.

1. Na Home confira: Carteirinha; Enviar Foto/QR Code; Meu Perfil/Solicitações; Configurações/Informações da Unidade.
2. Meu Perfil deve abrir /meus-dados, com os mesmos dados somente de consulta. Voltar mantém nome, foto e cache da Home.
3. Na carteirinha, clique ou toque em qualquer ponto para virar. Enter e Espaço funcionam com foco na carteirinha. Há um contorno de foco e indicação acessível da face/ação.
4. Confirme o texto Toque para virar a carteirinha, sem os antigos botões de frente/verso.
5. Confira dois logotipos sem distorção, foto ao lado dos dados e ausência do texto do Governo. A orientação atual foi preservada; não há reflow vertical ou rotação de 90 graus.
6. No verso, confira matrícula, admissão, validade, RG cadastral e QR. RG ausente/null/vazio/em branco mostra Não informado. Não há texto Carteirinha válida dentro do verso.
7. Teste foto pendente, conta bloqueada e demais estados inelegíveis: o flip não libera QR bloqueado. A verificação pública continua com seu comportamento anterior.
8. Ative movimento reduzido nas preferências do sistema ou na emulação de mídia do navegador; o giro deve ser instantâneo. Cliques rápidos durante a transição normal não devem enfileirar giros.

Larguras cobertas: 320, 375, 390, 430, 768 e 1440 px. Capturas usam avatar e dados sintéticos. Esses testes de UI não equivalem a homologação com a API de produção. Nenhuma alteração no backend, Secretaria, contratos, autenticação, cache ou emissão de QR foi feita nesta tarefa.
