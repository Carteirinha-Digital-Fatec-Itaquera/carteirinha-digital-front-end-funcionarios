# Home, Meu Perfil e flip — relatório técnico (26/11/2026)

## Origem e organização

Issue #12: [UX/UI] Reorganizar Home e implementar flip na carteirinha funcional.
Branch: feature/issue-12-home-perfil-flip.
Base: main f21f99c3b1e6bcc0be3d4607aaae235e44dc722f.

O PR #11 está fechado, sem merge; a proposta vertical cancelada não integra esta entrega. A main incorpora o PR #9 já aprovado. O PR #2 segue Draft de documentação e não foi alterado. Implementação exclusiva no Portal, em nova branch da main verificada.

## Home e perfil

Ordem: primeira fileira Carteirinha (duas colunas); segunda Enviar Foto / QR Code; terceira Meu Perfil / Solicitações; quarta Configurações / Informações da Unidade. O indicador de atualizações não lidas continua em Solicitações. O card Meu Perfil utiliza o mesmo componente visual dos demais e o ícone UserRound.

A rota /meus-dados e EmployeeProfile foram reutilizados; o título passou a Meu Perfil. Dados pessoais, contato, situação da conta, matrícula, admissão, funções, orientações e retorno ao menu foram preservados. O acesso isolado Conferir meus dados saiu da Home. Não há uma segunda tela de cadastro/perfil.

## Carteirinha

O componente CardFlip usa as faces na mesma grade, perspectiva de 2000 px, rotateY(180deg), preserve-3d, backface-visibility hidden e transição de 0,7 segundo com cubic-bezier(0.4, 0.2, 0.2, 1), seguindo o componente do Aluno. A frente e o verso continuam montados; a face inativa recebe aria-hidden e inert.

Um botão nativo transparente sobre a própria carteirinha permite clique, toque, Enter e Espaço, com foco visível, rótulo da face/ação, aria-pressed e estado anunciado. Os dados das faces mantêm sua semântica fora do botão. Cliques durante o giro e repetição de tecla não enfileiram movimentos; há limpeza do timer na desmontagem. prefers-reduced-motion desativa a transição. O texto centralizado é Toque para virar a carteirinha. Os controles separados de frente/verso foram retirados.

O design da main foi mantido, com foto ao lado dos dados no mobile e desktop. Não há rotação de 90 graus ou redistribuição vertical. A altura compartilhada das faces evita salto de layout durante o giro.

Foram retirados o texto Governo do Estado de São Paulo da frente e somente a indicação Carteirinha válida do verso. Os dois logotipos institucionais existentes foram distribuídos simetricamente, mantendo object-fit contain, sem trocar imagens. Nome, unidade e função da frente continuam em maiúsculas.

O RG já existe no EmployeeProfileView retornado por /funcionarios/me e já era consultado pela tela. O verso agora sempre exibe RG:, com o dado cadastral ou Não informado para ausente/null/vazio/branco. Não há chamada adicional, valor fixo de RG no código da aplicação ou escrita no cadastro. A grade do verso acomoda quatro campos no desktop e dois por fileira no mobile.

## Referência do Aluno

Main consultada: 880745a1401615592dd9561d671fb5783b3db011.

- [Componente do Aluno](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-aluno/blob/880745a1401615592dd9561d671fb5783b3db011/src/ui/screens/digitalstudent/DigitalStudentCardScreen.tsx)
- [Estilos do Aluno](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-aluno/blob/880745a1401615592dd9561d671fb5783b3db011/src/ui/screens/digitalstudent/style.module.css)

Foram analisados estrutura, estado, clique/teclado, eixo, duração, perspectiva e regras mobile. A adaptação preserva a orientação atual do Portal de Funcionários.

## Validação

- TypeScript e build Vite/PWA aprovados.
- Lint global: 0 erros e 0 avisos.
- Cache: 9 testes aprovados.
- CardFlip isolado em navegador: clique, toque, Enter/Espaço, foco, face inacessível/inert, repetição de tecla/cliques, remontagem e movimento reduzido. A animação mantém eixo Y, perspectiva e duração da referência.
- Playwright novo em 320, 375, 390, 430, 768 e 1440 px: ordem/linhas dos sete cards; Meu Perfil abaixo de Enviar Foto e na rota existente; sem atalho duplicado; nome/foto/cache mantidos; frente/verso, foto lateral, logotipos e textos; RG informado/null/ausente/vazio/branco; matrícula/admissão/validade; ausência dos controles e indicação removidos; QR elegível e bloqueado; URL insegura e API indisponível; sessão revogada; rota protegida direta sem sessão.
- Regressão existente do Portal em 390/768/1440: login/primeiro acesso/recuperação, sessão, fotos, conflitos, solicitações, validação pública, rotas e exclusões preservados.
- Regressão UX em 390/1440: cache/navegação, fotos, avisos, falha de rede e isolamento/revogação. Retorno pelo perfil registrou zero novas consultas privadas nos dois tamanhos (146 ms e 121 ms neste ambiente).

Os testes de navegador usam API simulada e dados/imagens sintéticos. Não representam homologação com a API de produção. Não foram alterados contratos, endpoints, hooks/cache, autenticação ou regras de elegibilidade/emissão de QR. Os corpos de QrScreen e VerificationScreen permaneceram idênticos à main; a remoção do texto é restrita ao verso visual.

## Evidências e execução

Capturas de Home/frente/verso para seis larguras estão na pasta de evidências local. As principais capturas mobile/desktop e RG ausente/QR bloqueado estão anexadas ao PR em docs/evidencias/home-perfil-flip. Consulte HOME_PERFIL_FLIP.md para instruções do VS Code, testes sem backend e validação manual com API local/de testes.

O harness isolado de componentes não é rota do aplicativo e foi verificado como ausente do bundle de produção. Não há dependências novas. Não foram alterados backend ou Secretaria, executadas migrações, usados dados reais ou configurada hospedagem.

## Situação

Entrega em PR Draft, com issue aberta. A revisão visual e funcional final permanece com o responsável. Sem merge ou deploy de produção nesta etapa.

## Arquivos alterados

- docs/HOME_PERFIL_FLIP.md
- docs/RELATORIO_HOME_PERFIL_FLIP.md
- package.json
- src/ui/components/cardFlip/CardFlip.tsx
- src/ui/components/cardFlip/style.module.css
- src/ui/screens/credential/CredentialScreens.tsx
- src/ui/screens/credential/card.module.css
- src/ui/screens/mainmenu/MainMenuScreen.tsx
- src/ui/screens/mainmenu/style.module.css
- src/ui/screens/profile/EmployeeProfile.tsx
- tests/components/flip.html
- tests/components/flip.tsx
- tests/flip.component.browser.mjs
- tests/home-flip.browser.mjs
- tests/portal.browser.mjs
- tests/ux.browser.mjs

Capturas sintéticas adicionais: docs/evidencias/home-perfil-flip/*.png.
