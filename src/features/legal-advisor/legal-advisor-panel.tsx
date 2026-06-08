"use client";

// المستشار القانوني للاستثمار (§هـ.5) — شقّان: أسئلة حرّة (محادثة RAG) · استمارة استعلام (ضوابط حتمية).

import { useState } from "react";
import { ClipboardList, Library, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdvisorChat } from "./advisor-chat";
import { AdvisorInquiryForm } from "./advisor-inquiry-form";
import { ConsultationsLibrary } from "./consultations-library";

const TABS = [
  { key: "chat", label: "أسئلة حرّة", icon: MessageSquare },
  { key: "form", label: "استمارة استعلام", icon: ClipboardList },
  { key: "library", label: "المكتبة", icon: Library },
] as const;

export function LegalAdvisorPanel() {
  const [tab, setTab] = useState<"chat" | "form" | "library">("chat");

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-1 border-b border-border/60 bg-gradient-to-l from-primary/10 to-transparent px-2 pt-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition",
                active ? "bg-background text-primary ring-1 ring-inset ring-border/60" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" /> {t.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1">
        <div className={cn("h-full", tab !== "chat" && "hidden")}>
          <AdvisorChat />
        </div>
        <div className={cn("h-full", tab !== "form" && "hidden")}>
          <AdvisorInquiryForm />
        </div>
        <div className={cn("h-full", tab !== "library" && "hidden")}>
          <ConsultationsLibrary />
        </div>
      </div>
    </div>
  );
}
