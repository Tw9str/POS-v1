const fs = require("fs");
const path = require("path");

const iconsDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(iconsDir, { recursive: true });

// Modern POS receipt/bill icon with "S" monogram
function makeIcon(size) {
  const s = size;
  const r = Math.round(s * 0.18);
  const pad = Math.round(s * 0.12);
  const rx = pad;
  const ry = pad;
  const rw = s - pad * 2;
  const rh = s - pad * 2;
  const rr = Math.round(s * 0.08);
  // Zigzag tear at bottom
  const zigCount = 6;
  const zigH = Math.round(s * 0.04);
  const zigW = rw / zigCount;
  let zigzag = "";
  for (let i = 0; i < zigCount; i++) {
    const x1 = rx + i * zigW + zigW / 2;
    const x2 = rx + (i + 1) * zigW;
    zigzag += `L${x1.toFixed(1)},${(ry + rh - zigH).toFixed(1)} L${x2.toFixed(1)},${(ry + rh).toFixed(1)} `;
  }

  const lineY1 = ry + rh * 0.18;
  const lineY2 = ry + rh * 0.28;
  const lineY3 = ry + rh * 0.72;
  const lineY4 = ry + rh * 0.8;
  const lineX1 = rx + rw * 0.18;
  const lineX2 = rx + rw * 0.82;
  const lineXmid = rx + rw * 0.55;
  const lineStroke = Math.max(1.5, s * 0.012);

  const sX = s / 2;
  const sY = s * 0.55;
  const sFontSize = Math.round(s * 0.32);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="receipt" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="${Math.round(s * 0.01)}" stdDeviation="${Math.round(s * 0.02)}" flood-color="#0f172a" flood-opacity="0.2"/>
    </filter>
  </defs>
  <rect width="${s}" height="${s}" rx="${r}" fill="url(#bg)"/>
  <path d="M${rx + rr},${ry} H${rx + rw - rr} Q${rx + rw},${ry} ${rx + rw},${ry + rr} V${(ry + rh - zigH).toFixed(1)} ${zigzag} V${ry + rr} Q${rx},${ry} ${rx + rr},${ry} Z" fill="url(#receipt)" filter="url(#shadow)"/>
  <line x1="${lineX1}" y1="${lineY1}" x2="${lineXmid}" y2="${lineY1}" stroke="#cbd5e1" stroke-width="${lineStroke}" stroke-linecap="round"/>
  <line x1="${lineX2 - rw * 0.12}" y1="${lineY1}" x2="${lineX2}" y2="${lineY1}" stroke="#cbd5e1" stroke-width="${lineStroke}" stroke-linecap="round"/>
  <line x1="${lineX1}" y1="${lineY2}" x2="${lineX1 + rw * 0.25}" y2="${lineY2}" stroke="#e2e8f0" stroke-width="${lineStroke}" stroke-linecap="round"/>
  <line x1="${lineX2 - rw * 0.08}" y1="${lineY2}" x2="${lineX2}" y2="${lineY2}" stroke="#e2e8f0" stroke-width="${lineStroke}" stroke-linecap="round"/>
  <text x="${sX}" y="${sY}" text-anchor="middle" dominant-baseline="central" font-family="system-ui,-apple-system,sans-serif" font-size="${sFontSize}" font-weight="800" fill="#1e40af">S</text>
  <line x1="${lineX1}" y1="${lineY3}" x2="${lineX2}" y2="${lineY3}" stroke="#cbd5e1" stroke-width="${lineStroke * 0.8}" stroke-linecap="round" stroke-dasharray="${Math.round(s * 0.015)} ${Math.round(s * 0.01)}"/>
  <line x1="${lineX1 + rw * 0.35}" y1="${lineY4}" x2="${lineX2}" y2="${lineY4}" stroke="#1e40af" stroke-width="${lineStroke * 1.4}" stroke-linecap="round"/>
</svg>`;
}

function makeFavicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="6" fill="url(#bg)"/>
  <rect x="7" y="5" width="18" height="23" rx="2" fill="white" opacity="0.95"/>
  <text x="16" y="19" text-anchor="middle" dominant-baseline="central" font-family="system-ui,sans-serif" font-size="13" font-weight="800" fill="#1e40af">S</text>
  <line x1="10" y1="9" x2="17" y2="9" stroke="#cbd5e1" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="19" y1="9" x2="22" y2="9" stroke="#cbd5e1" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="10" y1="24" x2="22" y2="24" stroke="#1e40af" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;
}

fs.writeFileSync(path.join(iconsDir, "icon-192.svg"), makeIcon(192));
fs.writeFileSync(path.join(iconsDir, "icon-512.svg"), makeIcon(512));
fs.writeFileSync(path.join(iconsDir, "apple-touch-icon.svg"), makeIcon(180));

const appDir = path.join(__dirname, "..", "src", "app");
fs.writeFileSync(path.join(appDir, "icon.svg"), makeFavicon());

console.log("Created:");
console.log("  public/icons/icon-192.svg");
console.log("  public/icons/icon-512.svg");
console.log("  public/icons/apple-touch-icon.svg");
console.log("  src/app/icon.svg (favicon)");
