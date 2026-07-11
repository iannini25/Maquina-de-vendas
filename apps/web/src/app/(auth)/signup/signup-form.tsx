"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { AuthInput, AuthPasswordInput } from "../_components/auth-fields";
import { signup, type SignupResult } from "./actions";

export function SignupForm() {
  const [state, formAction, isPending] = useActionState<SignupResult | null, FormData>(
    signup,
    null,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <AuthInput
        id="name"
        name="name"
        label="Seu nome"
        requiredMark
        icon="user"
        placeholder="Maria Silva"
        required
        error={state?.fieldErrors?.name}
      />
      <AuthInput
        id="workspaceName"
        name="workspaceName"
        label="Nome do negócio"
        requiredMark
        icon="briefcase"
        placeholder="Liderança IA"
        required
        error={state?.fieldErrors?.workspaceName}
      />
      <AuthInput
        id="email"
        name="email"
        type="email"
        label="E-mail"
        requiredMark
        icon="mail"
        autoComplete="email"
        placeholder="voce@empresa.com"
        required
        error={state?.fieldErrors?.email}
      />
      <AuthPasswordInput
        id="password"
        name="password"
        label="Senha"
        requiredMark
        autoComplete="new-password"
        placeholder="Mínimo 8 caracteres"
        required
        error={state?.fieldErrors?.password}
      />

      {state?.error && (
        <p
          role="alert"
          className="rounded-[11px] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" loading={isPending} className="w-full">
        {isPending ? "Criando workspace…" : "Criar minha máquina de vendas"}
      </Button>
    </form>
  );
}
