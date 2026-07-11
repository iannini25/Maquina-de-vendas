"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";

import { loginAction } from "./actions";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result.ok) {
        router.push(searchParams.get("callbackUrl") ?? "/dashboard");
        router.refresh();
      } else {
        setError(result.error ?? "Não foi possível entrar");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm text-ink-2">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="voce@empresa.com"
          className="w-full rounded-control border border-hairline bg-surface-2 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-3 transition-colors duration-200 focus:border-brand-3 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm text-ink-2">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="w-full rounded-control border border-hairline bg-surface-2 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-3 transition-colors duration-200 focus:border-brand-3 focus:outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-control py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:opacity-60"
        style={{
          background: "linear-gradient(135deg, #7C3AED, #A855F7)",
          boxShadow: "0 0 0 1px rgba(139,92,246,.25), 0 12px 40px -12px rgba(139,92,246,.45)",
        }}
      >
        {isPending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  );
}
