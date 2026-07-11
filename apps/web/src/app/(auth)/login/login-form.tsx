"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { AuthInput, AuthPasswordInput, RememberRow } from "../_components/auth-fields";
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
    <form
      onSubmit={handleSubmit}
      // Fallback pré-hidratação NUNCA pode ser GET (credenciais iriam à URL/logs)
      method="post"
      className="space-y-4"
      noValidate
    >
      <AuthInput
        id="email"
        name="email"
        type="email"
        label="E-mail"
        requiredMark
        icon="mail"
        autoComplete="email"
        required
        placeholder="voce@empresa.com"
      />
      <AuthPasswordInput
        id="password"
        name="password"
        label="Senha"
        requiredMark
        autoComplete="current-password"
        required
        placeholder="••••••••"
      />

      <RememberRow />

      {error && (
        <p
          role="alert"
          className="rounded-[11px] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" loading={isPending} className="w-full">
        {isPending ? "Entrando…" : "Entrar"}
      </Button>
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
