import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "../_components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Entrar na sua máquina"
      subtitle="Bem-vindo de volta. Cada login abre um ambiente isolado."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Criar workspace
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
