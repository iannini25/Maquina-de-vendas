/** Skeleton do Setup Gate (coluna central + cards + barra inferior). */
export default function SetupLoading() {
  return (
    <main className="relative min-h-dvh pb-32">
      <div className="mx-auto w-full max-w-[860px] px-6 pt-14">
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="skeleton mt-7 h-8 w-96 max-w-full rounded-lg" />
        <div className="skeleton mt-3 h-10 w-[620px] max-w-full rounded-lg" />
        <div className="mt-8 flex items-center gap-4">
          <div className="skeleton h-2 w-80 max-w-[40%] rounded-full" />
          <div className="skeleton h-4 w-52 rounded" />
          <div className="skeleton ml-auto h-8 w-28 rounded-full" />
        </div>
        <div className="mt-6 space-y-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-44 rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t border-hairline-soft bg-bg/85">
        <div className="mx-auto flex h-[76px] w-full max-w-[860px] items-center justify-between px-6">
          <div className="skeleton h-4 w-48 rounded" />
          <div className="skeleton h-11 w-44 rounded-full" />
        </div>
      </div>
    </main>
  );
}
