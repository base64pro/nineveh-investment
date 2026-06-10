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
        {/* تنبيهات عربية أنيقة وسط-علوية (§هـ.3.4 · §ز.2): كحلي + توهّج هولوكرامي + Readex + أيقونات ملوّنة */}
        <Toaster
          position="top-center"
          dir="rtl"
          closeButton
          expand
          gap={10}
          offset={20}
          duration={3500}
          toastOptions={{
            classNames: {
              toast:
                "!font-readex !gap-2.5 !rounded-2xl !border !border-[rgba(148,175,209,0.42)] !bg-[hsl(220_36%_16%_/_0.97)] !text-foreground !shadow-[0_22px_55px_-14px_rgba(0,0,0,0.78),0_0_26px_-10px_rgba(148,175,209,0.55)] !backdrop-blur-md",
              title: "!text-[13px] !font-bold !text-foreground",
              description: "!text-xs !text-muted-foreground",
              closeButton:
                "!border-[rgba(148,175,209,0.4)] !bg-card !text-muted-foreground hover:!bg-accent hover:!text-foreground",
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
