/** Skeleton do Pós-venda (topbar + abas + banner + tabela). */
export default function PosVendaLoading() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center border-b border-hairline-soft px-6">
        <div className="skeleton h-6 w-44 rounded-lg" />
      </header>
      <div className="flex flex-col gap-5 p-6">
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-9 w-32 rounded-lg" />
          ))}
        </div>
        <div className="skeleton h-12 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    </>
  );
}
