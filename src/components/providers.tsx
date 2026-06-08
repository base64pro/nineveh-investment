"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
        {/* تنبيهات عربية سلسة (§هـ.3 · §ز.2) */}
        <Toaster position="top-center" richColors closeButton dir="rtl" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
