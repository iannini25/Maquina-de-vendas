/** Skeleton do editor de template (coluna de estrutura + preview). */
export default function EditorTemplateLoading() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center border-b border-hairline-soft px-6">
        <div className="skeleton h-6 w-48 rounded-lg" />
      </header>
      <div className="flex h-[calc(100dvh-4rem)]">
        <aside className="flex w-[300px] shrink-0 flex-col gap-4 border-r border-hairline-soft p-5">
          <div className="skeleton h-4 w-24 rounded" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-[11px]" />
          ))}
        </aside>
        <section className="flex-1 p-6">
          <div className="skeleton mx-auto h-full max-w-[860px] rounded-xl" />
        </section>
      </div>
    </>
  );
}
