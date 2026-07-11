/** Skeleton do Criar com IA (shimmer). */
export default function CriarLoading() {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-hairline-soft px-6">
        <div>
          <div className="skeleton h-4 w-28" />
          <div className="skeleton mt-1.5 h-3 w-64" />
        </div>
        <div className="skeleton ml-auto h-9 w-36 rounded-full" />
      </div>
      <div className="p-6">
        <div className="skeleton h-40 w-full" />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`card-${i}`} className="skeleton h-32" />
          ))}
        </div>
        <div className="skeleton mt-6 h-5 w-52" />
        <div className="mt-3 grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`tpl-${i}`} className="skeleton h-32" />
          ))}
        </div>
      </div>
    </>
  );
}
