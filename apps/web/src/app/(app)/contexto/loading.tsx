/** Skeleton do Contexto (topbar + banner + card destaque + categorias + tabela). */
export default function ContextoLoading() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center border-b border-hairline-soft px-6">
        <div className="skeleton h-6 w-52 rounded-lg" />
      </header>
      <div className="flex flex-col gap-5 p-6">
        <div className="skeleton h-12 rounded-2xl" />
        <div className="skeleton h-72 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    </>
  );
}
