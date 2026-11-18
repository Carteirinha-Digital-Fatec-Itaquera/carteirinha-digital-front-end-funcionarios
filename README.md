# Carteirinha Digital — Portal de Funcionários

Portal de identificação da Fatec Itaquera. O layout vem do frontend de aluno e as cores do frontend de secretaria. A conta e a carteirinha usam os contratos V1 de funcionários. O QR é para verificação pública da credencial.

## Rodar localmente

Use Node.js 24 e npm. Configure `VITE_API_BASE_URL` no arquivo `.env.local`, a partir de `.env.example`.

```text
npm ci
npm run dev
npm run lint
npm run build
npm run preview
```

O Vite usa a URL da API na hora do build. Em desenvolvimento, a API pode rodar em `http://localhost:3000`; a origem do portal deve ser autorizada no CORS do backend. Use um backend de desenvolvimento com migrations de funcionários aplicadas, JWT configurado e contas sintéticas previamente provisionadas pela Secretaria. Para testar os links e o QR, configure `EMPLOYEE_APP_URL` com a origem exata do portal, sem caminho final (por exemplo, `http://localhost:5173`). A página pública de QR e a API usam o mesmo caminho; mantenha API e SPA em origens distintas ou configure um prefixo de API.

Na homologação, use HTTPS, `BREVO_API_KEY` e remetente verificado, Cloudinary privado e `PUBLIC_API_URL` para fotos de créditos quando houver proxy reverso. Configure contatos institucionais no backend conforme necessário. O host do portal deve encaminhar navegação direta para `index.html`, inclusive os links de ativação, redefinição e validação do QR.

## Testar com API simulada

Execute o build com `VITE_API_BASE_URL=http://localhost:3099`. Instale o Chromium do Playwright com `npx playwright install chromium` ou indique um Chromium instalado em `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Execute `npm run test:browser`. A suíte usa fixtures do contrato e intercepta a API. Cobre autenticação, ciclo de foto, solicitações, QR, indisponibilidade e navegação em 390×844 e 1440×900. Para salvar capturas com dados fictícios, defina `PORTAL_TEST_SCREENSHOTS` com o diretório de saída antes de rodar o teste. Validação de CORS, banco, entrega de e-mail e storage reais exige homologação.

## Primeiro acesso

Use **Solicitar primeiro acesso** com o e-mail cadastrado pela Secretaria. O portal dá a mesma confirmação para pedidos aceitos, sem confirmar se existe uma conta. A senha e sua confirmação são solicitadas apenas na tela aberta pelo link com token. Após salvar, a tela de login confirma a ativação. Na Home, **Conferir meus dados** mostra os dados já cadastrados; alterações cadastrais seguem pelo suporte. Se não houver foto aprovada, o portal informa como enviar ou acompanhar uma foto.

## Sessão e modo offline

O Bearer fica em `sessionStorage` com uma chave específica deste portal, preservando o login após recarregar na mesma aba. O fechamento da aba normalmente encerra essa persistência local. O backend revalida a conta antes de mostrar rotas privadas. Logout e troca de senha removem a credencial local. Logout local não revoga JWT em outros dispositivos. Acesso por script da mesma origem, incluindo XSS, continua sendo um risco inerente ao armazenamento acessível ao JavaScript. Servir o portal em origem exclusiva, com HTTPS e sem scripts de terceiros. Um futuro contrato com cookie HttpOnly permitiria eliminar esse risco de leitura direta do Bearer.

Os tokens dos links de acesso ficam em memória durante o formulário e são removidos da URL após leitura. O Service Worker guarda somente arquivos públicos do aplicativo. Offline é possível abrir a interface e ver o aviso de indisponibilidade. O portal não guarda cópia da carteirinha, fotos, tickets ou respostas de autenticação. O QR público consulta a situação atual.

## Lacuna da rejeição de foto

O backend mantém a foto aprovada anterior durante a análise de uma substituta. Ao rejeitar a substituta, `EmployeePhotoService.reviewPhoto` desmarca `currentPending`. `getMyPhotoStatus` seleciona apenas fotos marcadas como pendentes, e a credencial continua válida com a foto aprovada anterior. Nessa condição, a rejeição e o motivo podem ficar indisponíveis para o titular. A tela exibe o estado informado pela API, inclusive `PHOTO_REJECTED` quando a credencial o traz.

Para cobrir o caso, é preciso publicar um resumo da última tentativa do titular, separado de `approved` e `pending`, no contrato de `GET /funcionarios/me/foto`. O resumo deve disponibilizar o estado de revisão e, nas rejeições, o motivo autorizado. O resumo deve distinguir uma tentativa superada por novo envio ou removida pelo titular e não deve tornar a imagem rejeitada pública. Depois de atualizar tipos e fixtures, validar rejeição com carteira previamente aprovada em teste HTTP e adaptar a UI ao novo campo.

## Reabertura de solicitações

O backend atual rejeita `POST /support/tickets/:id/reopen` para `EMPLOYEE`: a regra do serviço exige `STUDENT`. O portal oferece iniciar uma nova solicitação quando a anterior está encerrada. Para suportar reabertura de funcionários, o backend precisa admitir o titular `EMPLOYEE`, mantendo as verificações de propriedade, estado terminal, prazo, versão e idempotência, com teste HTTP para esse papel.

## Referências

- [Issue de implementação #1](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-funcionarios/issues/1)
- [Planejamento no PR #2](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-funcionarios/pull/2)
- [Frontend de aluno, base visual](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-aluno/tree/880745a1401615592dd9561d671fb5783b3db011)
- [Tokens CSS da secretaria](https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-secretaria/blob/5eb1cc339cabb415627fa84481b0176ca65a75c5/src/index.css)
- [Contrato V1 de funcionários](docs/CONTRATO_API_FUNCIONARIOS.md)
