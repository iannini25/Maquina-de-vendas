import type { Metadata } from "next";
import Link from "next/link";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  return (
    <div className="rise-in">
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl text-xl font-bold text-white"
          style={{
            background: "linear-gradient(135deg, #7C3AED, #A855F7)",
            boxShadow: "var(--shadow-glow)",
          }}
        >
          V
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Crie sua máquina de vendas
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Um workspace isolado, com IA vendendo por você 24/7.
        </p>
      </div>

      <SignupForm />

      <p className="mt-6 text-center text-sm text-ink-3">
        Já tem conta?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
