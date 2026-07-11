"use client";

import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { formatDateBR } from "@/lib/format";
import { inviteMemberAction, updateProfileNameAction } from "@/server/setup/actions";

/** Espelho serializável de TeamMember (src/server/setup/queries). */
export interface TeamMemberDTO {
  membershipId: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  isYou: boolean;
}

const ROLE_LABELS: Record<string, { label: string; tone: "brand" | "info" | "muted" }> = {
  OWNER: { label: "Dono", tone: "brand" },
  ADMIN: { label: "Admin", tone: "info" },
  SELLER: { label: "Vendedor", tone: "muted" },
};

interface InviteSuccess {
  email: string;
  tempPassword?: string;
}

/** Aba Conta & Equipe — nome do usuário, membros e convite por e-mail. */
export function TeamTab({
  team,
  userName,
  userEmail,
  canInvite,
}: {
  team: TeamMemberDTO[];
  userName: string;
  userEmail: string;
  canInvite: boolean;
}) {
  const { toast } = useToast();

  const [name, setName] = useState(userName);
  const [savingName, setSavingName] = useState(false);

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<InviteSuccess | null>(null);

  async function saveName() {
    setSavingName(true);
    const result = await updateProfileNameAction(name);
    toast(
      result.ok ? "Nome atualizado." : (result.error ?? "Não foi possível salvar."),
      result.ok ? "success" : "danger",
    );
    setSavingName(false);
  }

  async function invite() {
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    const result = await inviteMemberAction({ name: inviteName, email: inviteEmail });
    if (!result.ok) {
      setInviteError(result.error ?? "Não foi possível convidar.");
    } else {
      setInviteSuccess({ email: result.email ?? inviteEmail, tempPassword: result.tempPassword });
      setInviteName("");
      setInviteEmail("");
      if (!result.tempPassword) {
        toast("Pessoa adicionada — ela entra com a senha que já usa.", "success");
      }
    }
    setInviting(false);
  }

  async function copyPassword(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      toast("Senha copiada.");
    } catch {
      toast("Não foi possível copiar — copie manualmente.", "danger");
    }
  }

  return (
    <div className="rise-in space-y-4">
      {/* Seu perfil */}
      <Card>
        <CardTitle hint={userEmail}>Seu perfil</CardTitle>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Input
              label="Seu nome"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Como você aparece no workspace"
            />
          </div>
          <Button
            variant="secondary"
            loading={savingName}
            disabled={name.trim().length < 2 || name.trim() === userName.trim()}
            onClick={saveName}
          >
            Salvar
          </Button>
        </div>
      </Card>

      {/* Membros */}
      <Card>
        <CardTitle hint={`${team.length} ${team.length === 1 ? "membro" : "membros"}`}>
          Membros do workspace
        </CardTitle>
        <ul className="divide-y divide-[rgba(255,255,255,0.05)]">
          {team.map((member) => {
            const role = ROLE_LABELS[member.role] ?? { label: member.role, tone: "muted" as const };
            return (
              <li key={member.membershipId} className="flex items-center gap-3 py-3">
                <Avatar name={member.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-ink">{member.name}</span>
                    {member.isYou && <Badge tone="brand">você</Badge>}
                  </span>
                  <span className="block truncate text-[11.5px] text-ink-3">{member.email}</span>
                </span>
                <span className="hidden text-[11px] text-ink-3 sm:block">
                  desde {formatDateBR(member.createdAt)}
                </span>
                <Badge tone={role.tone}>{role.label}</Badge>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Convite */}
      <Card>
        <CardTitle hint="cria o acesso na hora">Convidar por e-mail</CardTitle>
        {canInvite ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nome"
                placeholder="Maria Silva"
                value={inviteName}
                onChange={(event) => setInviteName(event.target.value)}
              />
              <Input
                label="E-mail"
                type="email"
                placeholder="maria@empresa.com"
                value={inviteEmail}
                error={inviteError ?? undefined}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
            </div>
            <div className="mt-4">
              <Button
                variant="secondary"
                className="border-brand-3/40 text-ink"
                loading={inviting}
                disabled={inviteName.trim().length < 2 || !inviteEmail.includes("@")}
                onClick={invite}
              >
                Convidar
              </Button>
            </div>

            {inviteSuccess?.tempPassword && (
              <div className="mt-4 rounded-[12px] border border-success/30 bg-success/[.08] p-4">
                <p className="text-[13px] font-semibold text-success">
                  Acesso criado para {inviteSuccess.email}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="rounded-[8px] border border-hairline bg-surface-2 px-3 py-1.5 font-mono text-[13px] text-ink">
                    {inviteSuccess.tempPassword}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyPassword(inviteSuccess.tempPassword ?? "")}
                  >
                    Copiar senha
                  </Button>
                </div>
                <p className="mt-2 text-[11.5px] text-ink-3">
                  Esta senha aparece uma única vez — envie por um canal seguro. O envio automático
                  por e-mail ainda não está configurado.
                </p>
              </div>
            )}
            {inviteSuccess && !inviteSuccess.tempPassword && (
              <p className="mt-3 text-[12.5px] text-success">
                {inviteSuccess.email} já tinha conta — foi adicionado ao workspace e entra com a
                própria senha.
              </p>
            )}
          </>
        ) : (
          <p className="text-[12.5px] text-ink-3">
            Só o dono ou admin do workspace pode convidar novos membros.
          </p>
        )}
      </Card>
    </div>
  );
}
