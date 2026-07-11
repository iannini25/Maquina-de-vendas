export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-[420px]">{children}</div>
    </main>
  );
}
