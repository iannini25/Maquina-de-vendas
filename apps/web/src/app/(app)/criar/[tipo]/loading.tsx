/** Skeleton dos fluxos do Criar com IA (shimmer). */
export default function CriarFluxoLoading() {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-hairline-soft px-6">
        <div>
          <div className="skeleton h-4 w-28" />
          <div className="skeleton mt-1.5 h-3 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-12 gap-6 p-6">
        <div className="col-span-12 flex flex-col gap-4 xl:col-span-5">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-10 w-64 rounded-full" />
          <div className="skeleton h-14 w-full" />
          <div className="skeleton h-14 w-full" />
          <div className="skeleton h-14 w-full" />
          <div className="skeleton h-11 w-full rounded-full" />
        </div>
        <div className="col-span-12 xl:col-span-7">
          <div className="skeleton h-80 w-full" />
        </div>
      </div>
    </>
  );
}
