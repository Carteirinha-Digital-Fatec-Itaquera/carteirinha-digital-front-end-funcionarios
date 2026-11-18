export function Status({ loading, error, reload }: { loading: boolean; error?: string; reload: () => void }) {
  if (loading) return <p role="status">Carregando…</p>;
  if (error) return <div role="alert"><p>{error}</p><button type="button" className="secondary-action" onClick={reload}>Tentar novamente</button></div>;
  return null;
}
