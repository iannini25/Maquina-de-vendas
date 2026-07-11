/** Skeleton do kanban durante o carregamento dos dados reais. */
export default function PipelineLoading() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-4 border-b border-hairline-soft px-6">
        <div className="skeleton h-6 w-28" />
        <div className="skeleton h-7 w-48 rounded-full" />
        <div className="ml-auto flex items-center gap-2.5">
          <div className="skeleton h-9 w-28 rounded-full" />
        </div>
      </div>
      <div className="flex items-center gap-2 px-6 pt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-32 rounded-full" />
        ))}
      </div>
      <div className="flex flex-1 gap-4 overflow-hidden px-6 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex w-[290px] shrink-0 flex-col gap-2.5">
            <div className="skeleton h-20 rounded-2xl" />
            <div className="skeleton h-36 rounded-xl" />
            <div className="skeleton h-36 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
