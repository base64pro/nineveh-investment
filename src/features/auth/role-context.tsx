"use client";

// م8.1 · سياق دور المستخدم — يُغذّى من الخادم (page.tsx) ويستهلكه كل بوّابات الواجهة.
// الإخفاء في الواجهة مكمّل؛ الفرض الحقيقي على القاعدة (RLS + حُرّاس RPC).

import { createContext, useContext, type ReactNode } from "react";

export type Role = "admin" | "viewer";

const RoleContext = createContext<Role>("viewer"); // افتراضي مقيّد (fail-closed)

export function RoleProvider({ role, children }: { role: Role; children: ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): { role: Role; isAdmin: boolean; isViewer: boolean } {
  const role = useContext(RoleContext);
  return { role, isAdmin: role === "admin", isViewer: role === "viewer" };
}
