import { MessageSquare, Plus, ArrowRight, Inbox } from "lucide-react";
import MessageModal from "../../components/MessageModal/MessageModal";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageLayout from "../../components/page/PageLayout";
import { ApiError, apiClient, buildApiError } from "../../../api/config/apiClient";
import "./support.css";

const categories: Record<string, string> = {
  DATA: "Dados cadastrais",
  PHOTO_CARD: "Foto ou carteirinha",
  ACCESS: "Acesso à conta",
  OTHER: "Outro problema",
};
const statuses: Record<string, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em atendimento",
  WAITING_STUDENT: "Aguardando você",
  RESOLVED: "Resolvido",
  CLOSED: "Encerrado",
};
type Ticket = {
  closeReason?: string | null;
  id: string;
  protocol: string;
  subject: string;
  category: string;
  status: string;
  version: number;
  unread: boolean;
  createdAt: string;
  assignedSecretaryId: number | null;
  requestedField?: string;
  proposedValue?: string;
};
type Message = {
  id: string;
  authorRole: string;
  body: string;
  createdAt: string;
};
type Detail = {
  ticket: Ticket;
  messages: Message[];
  messageNextCursor: string | null;
};
type Page = { items: Ticket[]; nextCursor: string | null };
async function request<T>(
  path: string,
  body?: object,
  signal?: AbortSignal,
): Promise<T> {
  const response = await apiClient("/support/tickets" + path, {
    authenticated: true,
    cache: "no-store",
    signal,
    ...(body ? { method: "POST", body } : {}),
  });
  if (!response.ok) {
    const error = await buildApiError(response);
    if (error.status === 403) await apiClient("/funcionarios/me", { authenticated: true, signal });
    throw error;
  }
  return response.json() as Promise<T>;
}
const date = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });

export default function SupportScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState<Page>({ items: [], nextCursor: null });
  const [detail, setDetail] = useState<Detail | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dangerAction, setDangerAction] = useState<"cancel" | "delete" | null>(
    null,
  );
  const [actionReason, setActionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [created, setCreated] = useState<Ticket | null>(null);
  const [showActions, setShowActions] = useState(false);
  const submitting = useRef(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    category: "DATA",
    subject: "",
    description: "",
    requestedField: "",
    proposedValue: "",
  });
  const [showNew, setShowNew] = useState(false);
  const createKey = useRef<{ payload: string; id: string } | null>(null);
  const actionKey = useRef<{ payload: string; id: string } | null>(null);
  const epoch = useRef(0);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const current = ++epoch.current;
      setError("");
      try {
        if (id) {
          const value = await request<Detail>("/" + id, undefined, signal);
          if (signal?.aborted || current !== epoch.current) return;
          setDetail(value);
          await request(
            "/" + id + "/read",
            { version: value.ticket.version },
            signal,
          );
        } else {
          const value = await request<Page>(
            "/me" + (status ? "?status=" + status : ""),
            undefined,
            signal,
          );
          if (!signal?.aborted && current === epoch.current) setPage(value);
        }
      } catch (e) {
        if (!signal?.aborted && current === epoch.current)
          setError(
            e instanceof Error ? e.message : "Não foi possível carregar.",
          );
      } finally {
        if (!signal?.aborted && current === epoch.current) setLoading(false);
      }
    },
    [id, status],
  );
  useEffect(() => {
    const counter = epoch;
    const controller = new AbortController();
    const refresh = () => {
      if (document.visibilityState !== "hidden") void load(controller.signal);
    };
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setDetail(null);
      setShowActions(false);
      setActionReason("");
      setMessage("");
      actionKey.current = null;
      refresh();
    });
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      counter.current++;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const body = {
        category: form.category,
        subject: form.subject,
        description: form.description,
        ...(form.category === "DATA" && form.requestedField
          ? {
              requestedField: form.requestedField,
              ...(form.proposedValue
                ? { proposedValue: form.proposedValue }
                : {}),
            }
          : {}),
      };
      const payload = JSON.stringify(body);
      if (createKey.current?.payload !== payload) createKey.current = { payload, id: crypto.randomUUID() };
      const value = await request<Ticket>("", { ...body, requestId: createKey.current.id });
      createKey.current = null;
      setCreated(value);
      setShowNew(false);
      setForm({
        category: "DATA",
        subject: "",
        description: "",
        requestedField: "",
        proposedValue: "",
      });
      navigate("/suporte/" + value.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) await load();
      setError(e instanceof Error ? e.message : "Falha ao abrir solicitação.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function act(action: string, extra?: object) {
    if (!detail || !id || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const payload = JSON.stringify({
      action,
      message: message.trim(),
      extra,
      expectedVersion: detail.ticket.version,
    });
    if (!actionKey.current || actionKey.current.payload !== payload)
      actionKey.current = { payload, id: crypto.randomUUID() };
    try {
      await request("/" + id + "/" + action, {
        requestId: actionKey.current.id,
        expectedVersion: detail.ticket.version,
        ...(extra ?? { message: message.trim() }),
      });
      actionKey.current = null;
      setMessage("");
      setActionReason("");
      if (action === "delete") {
        navigate("/suporte", { replace: true });
        return;
      }
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) await load();
      setError(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function moreMessages() {
    if (!detail?.messageNextCursor || !id) return;
    setBusy(true);
    try {
      const older = await request<Detail>(
        "/" + id + "?cursor=" + detail.messageNextCursor,
      );
      setDetail({
        ...detail,
        messages: [...older.messages, ...detail.messages],
        messageNextCursor: older.messageNextCursor,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar.");
    } finally {
      setBusy(false);
    }
  }
  async function moreTickets() {
    setBusy(true);
    try {
      const next = await request<Page>(
        "/me?cursor=" + page.nextCursor + (status ? "&status=" + status : ""),
      );
      setPage({
        items: [...page.items, ...next.items],
        nextCursor: next.nextCursor,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar.");
    } finally {
      setBusy(false);
    }
  }
  const terminal =
    detail && ["RESOLVED", "CLOSED"].includes(detail.ticket.status);
  const statusLabel = (ticket: Ticket) =>
    ticket.closeReason?.startsWith("CANCELLED_")
      ? "Cancelado"
      : statuses[ticket.status] || ticket.status;
  return (
    <PageLayout
      title={id ? "Detalhes da solicitação" : "Minhas Solicitações"}
      subtitle="Acompanhe suas solicitações e converse com a Secretaria."
      backTo={id ? "/suporte" : "/"}
      backLabel={id ? "Minhas solicitações" : "Voltar ao menu"}
      icon={<MessageSquare aria-hidden="true" />}
      roundedHeader
    >
      <section className="student-support" aria-busy={busy || loading}>
        {error && (
          <div role="alert" className="support-error">
            {error}
            {!showNew && (
              <button type="button" disabled={busy} onClick={() => void load()}>
                Tentar novamente
              </button>
            )}
          </div>
        )}
        {!id && (
          <>
            {!showNew && (
              <div className="support-toolbar">
                <label>
                  Filtrar por situação
                  <select
                    value={status}
                    disabled={busy}
                    onChange={(e) => {
                      setLoading(true);
                      setStatus(e.target.value);
                    }}
                  >
                    <option value="">Todas as situações</option>
                    {Object.entries(statuses).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="support-primary"
                  onClick={() => {
                    setError("");
                    setShowNew(true);
                  }}
                >
                  <Plus size={18} aria-hidden="true" />
                  Nova solicitação
                </button>
              </div>
            )}
            {showNew && (
              <form onSubmit={create} className="support-form">
                <div className="support-section-heading">
                  <h2>Nova solicitação</h2>
                  <p>Conte à Secretaria como podemos ajudar.</p>
                </div>
                <p className="support-muted">
                  Campos com * são obrigatórios. Não envie senhas, códigos de
                  acesso ou documentos sensíveis.
                </p>
                <fieldset disabled={busy}>
                  <label>
                    Categoria *
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          category: e.target.value,
                        })
                      }
                    >
                      {Object.entries(categories).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Assunto *
                    <input
                      placeholder="Resuma o que você precisa"
                      required
                      minLength={5}
                      maxLength={120}
                      value={form.subject}
                      onChange={(e) =>
                        setForm({ ...form, subject: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Descrição do problema *
                    <textarea
                      placeholder="Descreva o que aconteceu e como podemos ajudar (mínimo de 20 caracteres)."
                      required
                      minLength={20}
                      maxLength={3000}
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                    />
                  </label>
                  {form.category === "DATA" && (
                    <>
                      <label>
                        Informação a conferir (opcional)
                        <select
                          value={form.requestedField}
                          onChange={(e) =>
                            setForm({ ...form, requestedField: e.target.value })
                          }
                        >
                          <option value="">Selecione</option>
                          <option value="NAME">Nome completo</option>
                          <option value="SOCIAL_NAME">Nome social</option>
                          <option value="EMAIL">E-mail</option>
                          <option value="OTHER">Outra informação</option>
                        </select>
                      </label>
                      {form.requestedField && (
                        <label>
                          Informação correta proposta (opcional)
                          <input
                            maxLength={160}
                            value={form.proposedValue}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                proposedValue: e.target.value,
                              })
                            }
                          />
                        </label>
                      )}
                    </>
                  )}
                </fieldset>
                <div className="support-tools">
                  <button
                    className="support-primary"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? "Enviando solicitação…" : "Enviar solicitação"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setShowNew(false)}
                  >
                    Voltar à lista
                  </button>
                </div>
              </form>
            )}
            {!showNew && (
              <>
                {loading && (
                  <p className="support-empty" role="status">
                    Carregando solicitações…
                  </p>
                )}
                {!loading && !error && !page.items.length && (
                  <div className="support-empty">
                    <Inbox size={36} aria-hidden="true" />
                    <h2>
                      {status
                        ? "Nenhuma solicitação nesta situação"
                        : "Você ainda não tem solicitações"}
                    </h2>
                    <p>
                      {status
                        ? "Escolha outra situação para consultar seus atendimentos."
                        : "Precisa de ajuda com a carteirinha, seus dados ou acesso? Abra uma solicitação."}
                    </p>
                    {status && (
                      <button
                        onClick={() => {
                          setLoading(true);
                          setStatus("");
                        }}
                      >
                        Limpar filtro
                      </button>
                    )}
                  </div>
                )}
                {!loading && (
                  <ul className="support-list">
                    {page.items.map((ticket) => (
                      <li key={ticket.id}>
                        <Link
                          to={"/suporte/" + ticket.id}
                          className="support-ticket"
                        >
                          <div className="support-ticket-top">
                            <span
                              className={
                                "support-badge status-" + ticket.status
                              }
                            >
                              {statusLabel(ticket)}
                            </span>
                            {ticket.unread && (
                              <span className="support-unread">
                                Nova atualização
                              </span>
                            )}
                          </div>
                          <h2>{ticket.subject}</h2>
                          <p className="support-muted">
                            {(categories[ticket.category] ?? "Outro assunto")} · {ticket.protocol}
                          </p>
                          <div className="support-ticket-bottom">
                            <time dateTime={ticket.createdAt}>
                              {date(ticket.createdAt)}
                            </time>
                            <span>
                              Ver detalhes{" "}
                              <ArrowRight size={16} aria-hidden="true" />
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {!loading && page.nextCursor && (
                  <button disabled={busy} onClick={() => void moreTickets()}>
                    {busy ? "Carregando…" : "Carregar mais solicitações"}
                  </button>
                )}
              </>
            )}
          </>
        )}
        {id && !detail && !error && (
          <p role="status" className="support-empty">
            Carregando atendimento…
          </p>
        )}
        {detail && (
          <>
            <header className="support-detail-header">
              <span className={"support-badge status-" + detail.ticket.status}>
                {statusLabel(detail.ticket)}
              </span>
              <h2>{detail.ticket.subject}</h2>
              <p className="support-muted">
                {detail.ticket.protocol} · {(categories[detail.ticket.category] ?? "Outro assunto")}
              </p>
              <p className="support-muted">
                Aberta em{" "}
                <time dateTime={detail.ticket.createdAt}>
                  {date(detail.ticket.createdAt)}
                </time>
              </p>
            </header>
            {(detail.ticket.requestedField ||
              detail.ticket.proposedValue) && (
              <details className="support-additional">
                <summary>Informações da solicitação</summary>
                {detail.ticket.requestedField && (
                  <p>
                    Informação a conferir:{" "}
                    {(
                      {
                        NAME: "Nome completo",
                        SOCIAL_NAME: "Nome social",
                        EMAIL: "E-mail",
                        OTHER: "Outra informação",
                      } as Record<string, string>
                    )[detail.ticket.requestedField] ||
                      detail.ticket.requestedField}
                  </p>
                )}
                {detail.ticket.proposedValue && (
                  <p>Informação proposta: {detail.ticket.proposedValue}</p>
                )}
              </details>
            )}
            <section className="support-thread" aria-label="Acompanhamento">
              <h2>Acompanhamento</h2>
              <p className="support-muted">
                Sua descrição e as respostas da Secretaria, em uma conversa.
              </p>
              {detail.messageNextCursor && (
                <button disabled={busy} onClick={() => void moreMessages()}>
                  Mensagens anteriores
                </button>
              )}
              <ol className="support-conversation">
                {detail.messages.map((item) => (
                  <li
                    className={
                      item.authorRole === "EMPLOYEE"
                        ? "support-message-student"
                        : "support-message-secretary"
                    }
                    key={item.id}
                  >
                    <div>
                      <strong>
                        {item.authorRole === "EMPLOYEE" ? "Você" : "Secretaria"}
                      </strong>
                      <time dateTime={item.createdAt}>
                        {date(item.createdAt)}
                      </time>
                    </div>
                    <p>{item.body}</p>
                  </li>
                ))}
              </ol>
            </section>
            <section
              className="support-reply"
              aria-label="Responder ao atendimento"
            >
              <label>
                {terminal
                  ? "Mensagem para reabrir ou confirmar a solução"
                  : "Sua mensagem"}
                <textarea
                  disabled={busy}
                  minLength={terminal ? 3 : 1}
                  maxLength={3000}
                  placeholder={
                    terminal
                      ? "Informe o motivo ou confirme que o problema foi resolvido."
                      : "Escreva sua resposta para a Secretaria…"
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>
              <div className="support-tools">
                {!terminal && (
                  <button
                    className="support-primary"
                    disabled={busy || !message.trim()}
                    onClick={() => void act("messages")}
                  >
                    {busy ? "Enviando…" : "Enviar mensagem"}
                  </button>
                )}
                {detail.ticket.status === "RESOLVED" && (
                  <button
                    className="support-primary"
                    disabled={busy || message.trim().length < 3}
                    onClick={() => void act("close")}
                  >
                    Confirmar solução e encerrar
                  </button>
                )}
                {terminal && (
                  <button
                    disabled={busy || message.trim().length < 3}
                    onClick={() => void act("reopen")}
                  >
                    Reabrir solicitação
                  </button>
                )}
              </div>
              {terminal && (
                <p className="support-muted">
                  Informe ao menos 3 caracteres. Reabertura disponível por até
                  sete dias após a resolução ou o encerramento.
                </p>
              )}
            </section>
            <div className="support-other-actions">
              <button
                aria-expanded={showActions}
                aria-controls="support-danger-actions"
                onClick={() => setShowActions(!showActions)}
              >
                Outras ações
              </button>
              {showActions && (
                <div id="support-danger-actions">
                  <p className="support-muted">
                    Use estas opções para cancelar o atendimento ou retirar a
                    solicitação das listas.
                  </p>
                  <label>
                    Motivo para cancelar ou excluir
                    <input
                      disabled={busy}
                      maxLength={1000}
                      minLength={3}
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                    />
                  </label>
                  <p className="support-muted">
                    Informe ao menos 3 caracteres. Você poderá revisar antes de
                    confirmar.
                  </p>
                  <div className="support-tools">
                    {!terminal && (
                      <button
                        disabled={busy || actionReason.trim().length < 3}
                        onClick={() => setDangerAction("cancel")}
                      >
                        Cancelar solicitação
                      </button>
                    )}
                    <button
                      disabled={busy || actionReason.trim().length < 3}
                      onClick={() => setDangerAction("delete")}
                    >
                      Excluir solicitação
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>
      <MessageModal
        visible={created !== null}
        tone="success"
        title="Solicitação criada com sucesso!"
        message="Sua solicitação foi registrada. Você pode acompanhar o andamento em Minhas Solicitações."
        details={created?.protocol ? ["Protocolo: " + created.protocol] : []}
        confirmText="Ver solicitação"
        cancelText="Voltar à lista"
        onConfirm={() => setCreated(null)}
        onCancel={() => {
          setCreated(null);
          navigate("/suporte");
        }}
      />
      <MessageModal
        visible={dangerAction !== null}
        tone="warning"
        title={
          dangerAction === "delete"
            ? "Excluir solicitação?"
            : "Cancelar solicitação?"
        }
        message={
          dangerAction === "delete"
            ? "A solicitação será retirada das listas do funcionário e da Secretaria. O histórico será preservado para auditoria."
            : "O atendimento será encerrado como cancelado. Você poderá reabri-lo dentro do prazo de sete dias."
        }
        confirmText={
          dangerAction === "delete"
            ? "Confirmar exclusão"
            : "Confirmar cancelamento"
        }
        cancelText="Voltar"
        onCancel={() => setDangerAction(null)}
        onConfirm={() => {
          const action = dangerAction;
          setDangerAction(null);
          if (action && !busy)
            void act(action, {
              reason: actionReason.trim(),
              confirmed: true,
            });
        }}
      />
    </PageLayout>
  );
}
