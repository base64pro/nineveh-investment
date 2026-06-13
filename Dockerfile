# م6.5 · نشر Render عبر Docker — Node 22 + Chromium من النظام (Puppeteer لتصدير PDF).
FROM node:22-bookworm-slim

# Chromium من حزم النظام (أمتن من تنزيل Puppeteer داخل البناء) + خطوط ومكتبات
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-liberation fontconfig ca-certificates \
    libnss3 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdrm2 libgbm1 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libasound2 libpango-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Puppeteer يستخدم Chromium النظام مباشرة — لا تنزيل وقت التثبيت
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# اعتماديات كاملة (تشمل devDependencies — يحتاجها next build) — قبل النسخ للاستفادة من الكاش
COPY package*.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* تُحقَن في حزمة العميل وقت البناء — Render يمرّر متغيّرات الخدمة كـbuild args
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
# next start يحترم PORT الذي يحقنه Render
CMD ["npm", "run", "start"]
