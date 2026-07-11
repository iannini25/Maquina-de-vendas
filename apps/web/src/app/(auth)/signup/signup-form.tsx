"use client";

import { useActionState } from "react";

import { signup, type SignupResult } from "./actions";

const inputClass =
  "w-full rounded-control border border-hairline bg-surface-2 px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-3 transition-colors duration-200 focus:border-brand-3 focus:outline-none";

function Field({
  id,
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-ink-2">
        {label} <span className="text-danger">*</span>
      </label>
      <input id={id} name={id} className={inputClass} {...props} />
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function SignupForm() {
  const [state, formAction, isPending] = useActionState<SignupResult | null, FormData>(
    signup,
    null,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field id="name" label="Seu nome" placeholder="Maria Silva" required error={state?.fieldErrors?.name} />
      <Field
        id="workspaceName"
        label="Nome do negócio"
        placeholder="Liderança IA"
        required
        error={state?.fieldErrors?.workspaceName}
      />
      <Field
        id="email"
        label="E-mail"
        type="email"
        autoComplete="email"
        placeholder="voce@empresa.com"
        required
        error={state?.fieldErrors?.email}
      />
      <Field
        id="password"
        label="Senha"
        type="password"
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres"
        required
        error={state?.fieldErrors?.password}
      />

      {state?.error && (
        <p role="alert" className="rounded-control border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {state.error}
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
        {isPending ? "Criando workspace…" : "Criar minha máquina de vendas"}
      </button>
    </form>
  );
}
