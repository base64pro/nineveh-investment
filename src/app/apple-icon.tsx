// م7.16 · أيقونة الشاشة الرئيسية للجوال/اللوحي (apple-touch-icon) — دبوس خريطة هولوكرامي على كحلي
// مع لمسة ذهبية. تُولَّد PNG عبر ImageResponse من نفس SVG هوية النظام (icon.svg).
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180" fill="none">
  <defs>
    <radialGradient id="bg" cx="50%" cy="34%" r="82%">
      <stop offset="0%" stop-color="#19294a"/>
      <stop offset="100%" stop-color="#070d18"/>
    </radialGradient>
    <linearGradient id="pin" x1="46" y1="40" x2="134" y2="146" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#eef4ff"/>
      <stop offset="50%" stop-color="#9fc0e8"/>
      <stop offset="100%" stop-color="#c7a24e"/>
    </linearGradient>
  </defs>
  <rect width="180" height="180" rx="40" fill="url(#bg)"/>
  <rect x="7.5" y="7.5" width="165" height="165" rx="33" fill="none" stroke="#9fc0e8" stroke-opacity="0.25" stroke-width="1.5"/>
  <circle cx="90" cy="82" r="50" fill="#9fc0e8" opacity="0.13"/>
  <path d="M90 38C66.5 38 47.5 57 47.5 80.5C47.5 110 90 146 90 146C90 146 132.5 110 132.5 80.5C132.5 57 113.5 38 90 38Z" fill="url(#pin)"/>
  <circle cx="90" cy="80" r="18.5" fill="#0a1322"/>
  <circle cx="90" cy="80" r="8.5" fill="url(#pin)"/>
</svg>`;

export default function AppleIcon() {
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(SVG).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width={180} height={180} src={dataUri} alt="نينوى" />
      </div>
    ),
    size,
  );
}
