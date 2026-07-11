import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
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
          Bem-vindo de volta
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Sua máquina de vendas não dorme. Entre para acompanhar.
        </p>
      </div>

      <LoginForm />

      <p className="mt-6 text-center text-sm text-ink-3">
        Ainda não tem conta?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Criar workspace
        </Link>
      </p>
    </div>
  );
}
