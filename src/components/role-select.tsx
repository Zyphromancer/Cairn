"use client";

import { useTransition } from "react";
import { updateMemberRole } from "@/app/actions";

const ROLES = ["owner", "admin", "member", "guest"] as const;

export function RoleSelect({
  workspaceId,
  memberId,
  role,
  disabled,
}: {
  workspaceId: string;
  memberId: string;
  role: string;
  disabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={role}
      disabled={disabled || isPending}
      onChange={(event) => {
        const nextRole = event.target.value as (typeof ROLES)[number];
        startTransition(() => {
          updateMemberRole(workspaceId, memberId, nextRole);
        });
      }}
      className="rounded-[var(--radius-cairn)] border border-border bg-surface px-2 py-1 text-xs uppercase tracking-wide disabled:opacity-60"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}
