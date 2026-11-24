# Investigação de fotografia e QR do Portal de Funcionários
Referências revisadas em 23/11/2026

A investigação inspecionou a implementação da main dos três sistemas. Nenhuma consulta ao banco de produção, upload real, alteração de regra ou correção desses dois problemas foi executada. O histórico de testes HTTP locais demonstra que o fluxo aceita e persiste fotografias sintéticas quando armazenamento e PostgreSQL estão disponíveis. Esse histórico não comprova a persistência da fotografia específica relatada pela equipe.

## Fotografia

Fatos confirmados no código

O Portal envia POST /funcionarios/me/foto em multipart/form-data, com file, expectedVersion e requestId UUID. A imagem é comprimida pelo cliente. O backend limita a imagem a 200 KB, inspeciona bytes e dimensões usando sharp e obtém employeeId da sessão autenticada. A versão verifica concorrência, e o identificador da operação permite retentativa idempotente.

O backend reserva uma EmployeePhoto ligada por employeeId ao UUID de Employee. O registro tem requestId, storageKey, contentHash, reviewStatus, processingState, currentApproved e currentPending. O armazenamento utiliza uploadPrivateEmployeePhoto no Cloudinary, type authenticated e overwrite false. O registro começa PENDING/UPLOADING. Após upload bem-sucedido, uma transação bloqueia o funcionário, confere a versão e passa a imagem a PENDING/READY/currentPending=true, incrementando a versão e gravando PHOTO_UPLOADED na auditoria. Falha do provedor retorna 503 STORAGE_UNAVAILABLE e marca FAILED. Imagens privadas são servidas por rotas autenticadas, não por URL pública.

O envio com sucesso é diferente da existência de uma solicitação de suporte. Nenhum ticket de suporte é criado nesse caminho.

A Secretaria utiliza GET /secretaria/fotos-pendentes, que chama StudentService.getPendingPhotos e consulta somente prisma.student com photoStatus=PENDING e photo não nula. A tela PhotosScreen tipa cada item por ra, nome, e-mail e photo. Suas ações de avaliação usam RA. A contagem no menu utiliza a mesma função de alunos. Assim, EmployeePhoto não participa dessa consulta e não é exibida nessa tela.

Já existe no backend uma fila de funcionários, GET /funcionarios/fotos/pendentes, resposta paginada {items,nextCursor}, e o resumo GET /funcionarios/fotos/resumo. A listagem filtra PENDING, READY e currentPending=true. Cada item contém employeeId, photoId, employeeVersion e contentUrl privada. A avaliação é PATCH /funcionarios/:id/fotos/:photoId/avaliacao, com expectedVersion, approved e reason obrigatório em rejeição. AuthGuard e SecretaryActiveGuard protegem essa API. Não se identificou uma proibição de análise por Secretaria ativa. A tela atual da Secretaria não consome essa API.

Causa confirmada no caminho de implementação

Há uma lacuna na interface de aprovação da Secretaria. Ela consulta e avalia somente fotos de alunos. O backend possui o fluxo próprio de funcionários com identificadores e contrato diferentes. Essa lacuna explica a ausência de itens de funcionários na tela de fotos utilizada atualmente.

O que ainda precisa ser comprovado no caso relatado

Sem rastrear uma requisição e os registros da conta em um ambiente autorizado, não é possível afirmar que a foto específica chegou ao estado READY/currentPending. Para confirmar posteriormente, observar o HTTP 201, photoId, requestId e version da resposta, consultar a fila autenticada de funcionários e conferir EmployeePhoto e PHOTO_UPLOADED em ambiente isolado. Verificar também se o Portal e a Secretaria usam a mesma instância de API e banco. A divergência de instâncias é hipótese ambiental, não a causa confirmada da consulta exclusiva de alunos.

Pendência adicional encontrada

A rejeição muda a imagem para REJECTED/DELETE_PENDING/currentPending=false. getMyPhotoStatus retorna apenas READY e os ponteiros de foto atual. O mapper e a elegibilidade procuram a rejeição com READY. Com isso, a tentativa rejeitada pode deixar de aparecer no retorno do titular, sobretudo com uma foto aprovada anterior. Esse problema já limita a apresentação de rejeição. Não foi corrigido nesta etapa.

Implementação futura e testes necessários

Adicionar na Secretaria a fila própria de funcionários, seus filtros/paginação, contagem e prévia autenticada. Preservar as avaliações de alunos e usar os UUIDs e expectedVersion corretos em funcionários. Validar permissão de Secretaria ativa, acesso cruzado, expiração de sessão, fila vazia, paginação, 409, motivo de rejeição, falha de armazenamento e a retenção da foto aprovada enquanto a substituta aguarda análise. Em PostgreSQL descartável, testar upload -> fila -> prévia -> avaliação -> consulta do titular. Projetar separadamente uma resposta para a última tentativa rejeitada sem expor a imagem rejeitada.

Arquivos e evidências

Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-funcionarios/src/api/employee.ts e src/ui/screens/uploadimage/PhotoScreen.tsx
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/864e5bbc257d000b95c6869e1c0158fb60952ef9/src/employee/employee-self.controller.ts
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/864e5bbc257d000b95c6869e1c0158fb60952ef9/src/employee/employee-photo.service.ts
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/864e5bbc257d000b95c6869e1c0158fb60952ef9/src/employee/employee-photo.controller.ts
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/864e5bbc257d000b95c6869e1c0158fb60952ef9/src/upload/upload.service.ts
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/864e5bbc257d000b95c6869e1c0158fb60952ef9/prisma/schema.prisma
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/864e5bbc257d000b95c6869e1c0158fb60952ef9/src/student/student.service.ts
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/864e5bbc257d000b95c6869e1c0158fb60952ef9/src/secretary/secretary.controller.ts
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-secretaria/blob/d9cd1c6a8acee9b4f52bb3d86bdfbdfeaaf1a530/src/api/student/getPendingPhotos.ts
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-secretaria/blob/d9cd1c6a8acee9b4f52bb3d86bdfbdfeaaf1a530/src/screens/secretary/photos/PhotosScreen.tsx
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-secretaria/blob/d9cd1c6a8acee9b4f52bb3d86bdfbdfeaaf1a530/src/components/menuLateral/MenuLateral.tsx

## QR Code

Fatos confirmados no código

O Portal consulta GET /funcionarios/me/carteirinha. EmployeeService.getMyCredentialCard fornece qrcode, verificationUrl, credential, funções ativas e caminho da foto aprovada. O QR é renderizado no cliente por QRCodeSVG da biblioteca qrcode.react, a partir de verificationUrl validada como HTTP(S), sem credenciais na URL e com caminho /funcionarios/verificar/.

QrScreen renderiza o QR somente quando card.credential.valid é verdadeiro e a URL é válida. Se a credencial for inválida, reasonLabels traduz PHOTO_PENDING para “Foto em análise.”. A mensagem relatada corresponde exatamente a esse ramo, e não a um indicador de carregamento da biblioteca.

EmployeeEligibilityService considera conta ativa/não arquivada, admissão já iniciada, ao menos uma função vigente e fotografia aprovada com processingState=READY e currentApproved=true. Sem fotografia aprovada, uma foto atual READY/currentPending gera PHOTO_PENDING e credential.valid=false. Havendo foto aprovada anterior, uma substituta pendente não invalida a carteirinha por si só.

O guard das rotas privadas valida papel employee, accountId, identidade, estado da conta e authVersion. A autorização provisória de primeiro acesso não equivale a uma sessão JWT do Portal. O usuário deve primeiro criar sua senha e efetuar login para consultar a carteirinha.

Existe validação pública em GET /funcionarios/verificar/:qrcode. O Portal utiliza estados válidos, inválidos e inexistentes conforme contrato. QR inexistente retorna 404, sessão ausente/revogada em rotas privadas retorna 401 e conta bloqueada/arquivada pode retornar 403 pelo guard. Uma credencial com foto pendente pode ser retornada em HTTP 200 como inválida por regra de negócio. Falhas de rede/API são apresentadas pelo componente Status.

O aluno também condiciona o QR à existência de photo e photoStatus=APPROVED. Seu endereço de validação é /valida/:qrcode. Funcionários usam a avaliação mais detalhada do backend e sua rota própria. A biblioteca não precisa de outra chamada para gerar pixels depois de receber a URL.

Causa identificada e relação com fotografia

A combinação PHOTO_PENDING e credential.valid=false bloqueia intencionalmente a renderização do QR. Há implementação tanto de geração/disponibilização do identificador quanto de renderização. A causa mais provável do caso relatado é a falta de fotografia aprovada, agravada pela ausência da fila de funcionários na interface da Secretaria. A mensagem é evidência desse caminho no cliente, mas não permite confirmar o registro e a instância específicos sem uma captura autorizada da resposta da API.

Correção futura

Primeiro integrar a avaliação de fotos de funcionários na Secretaria e testar a mudança da elegibilidade após aprovação. Confirmar a regra institucional antes de considerar qualquer alteração do bloqueio por foto pendente. Não substituir a URL por QR fictício nem liberar o QR ignorando credential.valid. Se a API retornar valid=true e uma URL correta mas o QR ainda estiver ausente, verificar resposta, DOM/SVG e política de conteúdo em ambiente de teste como um problema distinto.

Testes necessários

Cobrir conta ativa sem foto, foto pendente, foto aprovada, foto rejeitada, substituta pendente com aprovada anterior, admissão futura, funções futuras/vencidas, bloqueio, arquivamento, revogação de sessão, URL inválida e API indisponível. Decodificar um QR elegível e consultar a validação pública para conferir validade online e projeção mínima. Testar isolamento entre funcionários e persistência de estado após avaliação, sem escrever em produção.

Arquivos e evidências

https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-funcionarios/blob/c73b23a5c7cb0cbb1828843e8f0482419d0480b3/src/ui/screens/credential/CredentialScreens.tsx
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-funcionarios/blob/c73b23a5c7cb0cbb1828843e8f0482419d0480b3/src/api/employee.ts
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/864e5bbc257d000b95c6869e1c0158fb60952ef9/src/employee/employee.service.ts
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/864e5bbc257d000b95c6869e1c0158fb60952ef9/src/employee/employee-eligibility.service.ts
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/864e5bbc257d000b95c6869e1c0158fb60952ef9/src/employee/mapper/employee.mapper.ts
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-backend/blob/864e5bbc257d000b95c6869e1c0158fb60952ef9/src/employee/guards/employee-account.guard.ts
https://github.com/Carteirinha-Digital-Fatec-Itaquera/carteirinha-digital-front-end-aluno/blob/880745a1401615592dd9561d671fb5783b3db011/src/ui/screens/digitalStudentScan/DigitalStudentQrCode.tsx

A implementação visual mantém a condição credential.valid e o filtro da URL. A comparação da função QrScreen e da validação pública antes e depois dos ajustes confirmou equivalência semântica. O redesenho altera somente a área de apresentação do QR na carteirinha.
