# Validação das melhorias do Portal de Funcionários

Issue #4. A implementação parte da main c73b23a5c7cb0cbb1828843e8f0482419d0480b3.

## Telas

Meus dados organiza nome, nome social e RG em dados pessoais, e-mail e estado da conta em contato e situação cadastral, matrícula e admissão no vínculo institucional. Todas as funções e suas datas permanecem disponíveis. A consulta continua somente leitura e a correção cadastral segue pelo suporte.

Fotografia organiza a prévia e os controles em duas colunas no desktop e em uma coluna no celular. Remoção, substituição e descarte da prévia utilizam MessageModal. A confirmação destrutiva dá foco inicial ao cancelamento. Atualizar situação tem estado de carregamento e bloqueio durante as consultas. O contrato, a aprovação e a interpretação de rejeição existentes são preservados.

Informações da Unidade reproduz os grupos de contato e horário da tela de aluno. Endereço, nome, site e contatos configurados vêm da API. WhatsApp, telefone/e-mail de fallback e horário foram extraídos da main do aluno em 880745a1401615592dd9561d671fb5783b3db011, src/ui/screens/help/HelpScreen.tsx. O aluno apresenta esses contatos como texto. O Portal oferece WhatsApp, ligação, e-mail e busca do endereço no Maps. A precisão operacional desses contatos de referência deve ser confirmada pela unidade antes de publicar.

Login mantém o botão desabilitado e exibe Fazendo login com três pontos animados durante a requisição. A animação respeita prefers-reduced-motion. As credenciais permanecem preenchidas quando há erro. As regras de primeiro acesso continuam no backend.

A frente e o verso da carteirinha seguem a imagem incorporada ao MODELO CARTERINHA.docx fornecido pela equipe. A frente tem cabeçalho branco, marcas Fatec/CPS e identificação textual do Governo de São Paulo, faixa inferior azul-esverdeada, painel de nome/unidade/funções e foto à direita. O verso mostra matrícula, admissão, validade real, RG quando disponível, orientação e o mesmo QR condicionado à elegibilidade.

CPF e código de barras não estão disponíveis como campos destinados à carteirinha no contrato. Esses elementos do modelo foram omitidos. Não foi incluído brasão novo do Governo, pois o projeto não possui esse recurso verificado. A identificação textual acompanha os logotipos institucionais existentes. A orientação de uso foi adaptada ao documento digital, sem reproduzir instruções sobre afixar um crachá físico ou pedir segunda via por telefone.

## Testar no VS Code

1. Faça checkout de feature/issue-4-melhorias-ux-funcionarios e rode npm ci com Node.js 24.
2. Configure VITE_API_BASE_URL para uma API local ou de homologação autorizada. Rode npm run dev -- --port 5174.
3. Para o roteiro isolado, defina VITE_API_BASE_URL=http://localhost:3099, rode npm run build, npx playwright install chromium e npm run test:browser. A API desse roteiro é simulada e utiliza fixtures sintéticas.
4. Para salvar as capturas, defina PORTAL_TEST_SCREENSHOTS para uma pasta local antes de rodar o roteiro.
5. Confira Meus dados, fotografia com e sem foto, prévia, remoção, substituição, cancelamento, foco do modal, atualização, contatos, frente/verso, login em andamento e recuperação de erro. Teste larguras de 390, 768 e 1440 pixels.
6. Rode npm run lint e npm run build.

As investigações técnicas constam no relatório entregue com o PR. A fila de fotos da Secretaria consulta somente alunos, embora o backend possua uma fila de funcionários. PHOTO_PENDING bloqueia o QR por regra de elegibilidade. Nenhuma dessas regras foi alterada nesta entrega. O teste simulado não equivale à homologação de Cloudinary, banco ou fluxo real da Secretaria.

O PR permanece Draft para avaliação visual e funcional da equipe.

## Resultados

Lint e build aprovados. Playwright aprovado em 390×844, 768×1024 e 1440×900 com API simulada. O roteiro cobre bloqueio de envio duplicado no login, campos preservados após erro, movimento reduzido, foco e cancelamento dos modais, descarte, substituição, remoção e atualização da fotografia, contatos e Maps, navegação, carteirinha, QR, sessão e solicitações. As capturas da execução ficam em docs/evidencias-ux.
