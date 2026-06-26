import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'assets');
const C = { bg: '#010409', bg2: '#06101c', bg3: '#0d1117', text: '#f5f7fb', text2: '#b6c2d4', text3: '#7e8a9b', orange: '#e8834a', orange2: '#ffb26d', blue: '#4c8dff', cyan: '#6fd3ff', green: '#22c55e' };

function shell(width, height, body, clear = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${C.bg}"/><stop offset=".55" stop-color="${C.bg2}"/><stop offset="1" stop-color="${C.bg3}"/></linearGradient><linearGradient id="line" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${C.orange}" stop-opacity=".04"/><stop offset=".5" stop-color="${C.orange2}" stop-opacity="1"/><stop offset="1" stop-color="${C.orange}" stop-opacity=".04"/></linearGradient><filter id="og" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="sg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><style>.ui{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,system-ui,sans-serif}.title{fill:${C.text};font-size:58px;font-weight:820;letter-spacing:-2.5px}.eyebrow{fill:${C.orange2};font-size:13px;font-weight:800;letter-spacing:3px}.body{fill:${C.text2};font-size:19px}.h{fill:${C.text};font-size:24px;font-weight:800}.c{fill:${C.text};font-size:21px;font-weight:760}.s{fill:${C.text2};font-size:14px}.m{fill:${C.text3};font-size:12px;font-weight:700;letter-spacing:1.5px}.p{fill:rgba(17,24,33,.78);stroke:rgba(255,255,255,.10)}.o{stroke:${C.orange};fill:none;stroke-width:2;filter:url(#og)}.torus{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:820;animation:trace 13s linear infinite}@keyframes trace{to{stroke-dashoffset:-820}}</style></defs>${clear ? '' : `<rect width="${width}" height="${height}" rx="22" fill="url(#bg)"/>`}${body}</svg>`;
}

function divider() {
  return shell(1200, 34, `<rect width="1200" height="34" fill="transparent"/><rect x="48" y="16" width="1104" height="2" rx="1" fill="url(#line)" filter="url(#sg)"/><circle cx="80" cy="17" r="2.2" fill="${C.orange}" filter="url(#og)"><animate attributeName="cx" values="80;600;1120;600;80" dur="8s" repeatCount="indefinite"/><animate attributeName="opacity" values=".2;1;.2;1;.2" dur="8s" repeatCount="indefinite"/><animate attributeName="r" values="2.2;4;2.2;4;2.2" dur="8s" repeatCount="indefinite"/></circle>`, true);
}

function hero() {
  return shell(1200, 320, `<circle cx="955" cy="98" r="220" fill="${C.blue}" opacity=".08"/><circle cx="930" cy="86" r="110" fill="${C.cyan}" opacity=".10"/><circle cx="118" cy="290" r="180" fill="${C.orange}" opacity=".05"/><g opacity=".25">${Array.from({ length: 24 }, (_, i) => `<path d="M${i * 52} 0V320" stroke="${C.cyan}" opacity=".08"/>`).join('')}${Array.from({ length: 7 }, (_, i) => `<path d="M0 ${i * 52}H1200" stroke="${C.cyan}" opacity=".06"/>`).join('')}</g><g transform="translate(744 0)"><path class="torus" stroke="rgba(76,141,255,.30)" stroke-width="1.6" d="M62 202 C96 96 232 88 298 168 C350 232 292 310 190 286 C86 262 86 142 188 102 C332 46 484 126 500 222 C514 310 402 334 326 260 C250 186 300 96 404 104 C502 112 548 206 484 274 C404 360 202 334 142 238"/><path class="torus" stroke="rgba(111,211,255,.24)" stroke-width="1.1" d="M86 210 C122 132 232 126 286 184 C330 232 288 282 208 268 C130 252 136 168 216 136 C334 90 454 144 468 220 C480 286 398 304 338 248 C278 190 320 132 402 138 C476 144 508 210 460 258 C396 322 236 306 176 236"/><path class="torus" stroke="rgba(232,131,74,.30)" stroke-width="1.1" filter="url(#og)" d="M34 184 C150 260 292 92 408 158 C518 222 438 342 286 302 C124 260 136 76 304 96 C472 116 544 300 362 326 C206 348 66 282 92 188"/><circle cx="184" cy="102" r="3.6" fill="${C.orange}" filter="url(#og)"/><circle cx="404" cy="104" r="3.2" fill="${C.orange}" filter="url(#og)"/></g><g class="ui"><text x="30" y="52" class="eyebrow">BIOMEDICAL ENGINEERING FULL STACK</text><text x="30" y="126" class="title"><tspan x="30">Medical sensor systems from prototype</tspan><tspan x="30" dy="62">to real-world study devices.</tspan></text><text x="30" y="252" class="body"><tspan x="30">I build the hardware, firmware, data workflows, housings, and validation paths</tspan><tspan x="30" dy="30">that turn miniature sensing ideas into usable wearable and implantable medical systems.</tspan></text></g>`);
}

function activeProjects() {
  const card = (x, title, sub, state = 'ACTIVE') => `<g transform="translate(${x} 96)"><rect width="350" height="120" rx="18" class="p"/><circle cx="28" cy="30" r="5" fill="${state === 'ACTIVE' ? C.green : C.orange}"/><text x="46" y="35" class="m">${state}</text><text x="24" y="72" class="c">${title}</text><text x="24" y="102" class="s">${sub}</text></g>`;
  return shell(1200, 250, `<g class="ui"><rect x=".5" y=".5" width="1199" height="249" rx="22" fill="none" stroke="rgba(255,255,255,.10)"/><g transform="translate(36 30)"><path class="o" d="M0 18h8l4-14 6 28 5-18h8"/><path class="o" d="M0 38h34"/><text x="52" y="27" class="h">Active Projects</text><text x="52" y="49" class="m">current build focus</text></g>${card(36, '60 GHz mmWave radar', 'ESP32-C6 · live dashboard · WiFi provisioning')}${card(425, 'Proxmox homelab', 'TrueNAS · Nextcloud · Immich · containers')}${card(814, 'Profile asset system', 'portfolio polish · animated README · GitHub Actions', 'IN PROGRESS')}</g>`);
}

async function main() {
  await mkdir(out, { recursive: true });
  await Promise.all([
    rm(path.join(out, 'profile-card.svg'), { force: true }),
    rm(path.join(out, 'profile-card.png'), { force: true }),
    rm(path.join(out, 'github-stats-card.svg'), { force: true }),
    rm(path.join(out, 'activity-card.svg'), { force: true }),
    rm(path.join(out, 'cta-portfolio.svg'), { force: true }),
    rm(path.join(out, 'cta-linkedin.svg'), { force: true }),
    rm(path.join(out, 'cta-scholar.svg'), { force: true })
  ]);
  await Promise.all(Object.entries({ 'hero-banner.svg': hero(), 'section-divider.svg': divider(), 'active-projects-card.svg': activeProjects() }).map(([file, svg]) => writeFile(path.join(out, file), `${svg}\n`, 'utf8')));
}

main().catch((error) => { console.error(error); process.exit(1); });
