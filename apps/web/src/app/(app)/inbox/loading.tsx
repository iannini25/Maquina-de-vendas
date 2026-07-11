/** Skeleton do Inbox: 3 colunas com shimmer enquanto os dados chegam. */
export default function InboxLoading() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-16 shrink-0 items-center gap-4 border-b border-hairline-soft px-6">
        <div className="skeleton h-6 w-24" />
        <div className="skeleton h-7 w-48 rounded-full" />
        <div className="skeleton ml-auto h-9 w-36 rounded-full" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[300px] shrink-0 flex-col gap-3 border-r border-hairline-soft p-4">
          <div className="skeleton h-9 w-full rounded-[11px]" />
          <div className="flex gap-2">
            <div className="skeleton h-7 w-16 rounded-full" />
            <div className="skeleton h-7 w-24 rounded-full" />
            <div className="skeleton h-7 w-28 rounded-full" />
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton h-[76px] w-full rounded-xl" />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-hairline-soft px-5">
            <div className="skeleton size-9 rounded-full" />
            <div className="skeleton h-5 w-40" />
            <div className="skeleton ml-auto h-8 w-24 rounded-full" />
          </div>
          <div className="flex-1 space-y-4 p-6">
            <div className="skeleton mx-auto h-6 w-16 rounded-full" />
            <div className="skeleton h-12 w-2/3 rounded-2xl" />
            <div className="skeleton ml-auto h-16 w-1/2 rounded-2xl" />
            <div className="skeleton h-10 w-1/3 rounded-2xl" />
          </div>
          <div className="flex shrink-0 items-center gap-2.5 border-t border-hairline-soft p-4">
            <div className="skeleton h-10 w-36 rounded-[11px]" />
            <div className="skeleton h-10 flex-1 rounded-[11px]" />
            <div className="skeleton size-10 rounded-full" />
          </div>
        </div>
        <div className="hidden w-[280px] shrink-0 flex-col gap-4 border-l border-hairline-soft p-4 lg:flex">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-24 w-full rounded-2xl" />
          <div className="skeleton h-20 w-full rounded-2xl" />
          <div className="skeleton h-10 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
