/** Skeleton de ROI & Finanças (shimmer) enquanto as agregações carregam. */
export default function FinancasLoading() {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-hairline-soft px-6">
        <div>
          <div className="skeleton h-4 w-32" />
          <div className="skeleton mt-1.5 h-3 w-56" />
        </div>
        <div className="skeleton ml-auto h-9 w-24 rounded-full" />
      </div>
      <div className="p-6">
        <div className="skeleton h-9 w-72" />
        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`kpi-${i}`} className="skeleton h-24" />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-12 gap-4">
          <div className="skeleton col-span-12 h-56 xl:col-span-8" />
          <div className="skeleton col-span-12 h-56 xl:col-span-4" />
          <div className="skeleton col-span-12 h-64" />
        </div>
      </div>
    </>
  );
}
