import { ToastProvider } from "@/components/ui/toast";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <main className="min-h-dvh">{children}</main>
    </ToastProvider>
  );
}
