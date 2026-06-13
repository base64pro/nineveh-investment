"use client";

// §ز.3 · انقطاع الإنترنت: تنبيه واضح + تذكير أن الوظائف المعتمدة عليه (الخريطة/الذكاء/البحث) متوقّفة مؤقتاً.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

export function ConnectivityBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const onDown = (): void => setOffline(true);
    const onUp = (): void => {
      setOffline(false);
      toast.success("عاد الاتصال بالإنترنت");
    };
    window.addEventListener("offline", onDown);
    window.addEventListener("online", onUp);
    return () => {
      window.removeEventListener("offline", onDown);
      window.removeEventListener("online", onUp);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline ? (
        <motion.div
          initial={{ y: -36, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -36, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-x-0 top-0 z-[200] flex items-center justify-center gap-2 bg-state-withdrawn px-4 py-1.5 text-xs font-bold text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]"
          role="alert"
        >
          <WifiOff className="size-3.5 shrink-0" />
          انقطع الاتصال بالإنترنت — الخريطة والذكاء والبحث الجغرافي متوقّفة مؤقتاً، وبياناتك المحمّلة تبقى معروضة.
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
