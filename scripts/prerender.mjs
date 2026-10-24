// Post-build step: give every public route its own index.html with correct
// <title>, description, canonical and Open Graph tags baked in, and rebuild
// sitemap.xml with the published events and reflections.
//
// The site is a client-rendered SPA, so crawlers and link-preview bots that
// don't run JavaScript only ever see index.html's defaults. Writing
// dist/<route>/index.html fixes that without changing how the app runs: the
// same scripts load, React Router renders the route, and react-helmet-async
// replaces these tags (they carry data-rh) as soon as the page hydrates.
//
// Event and reflection data comes from Firestore's public REST API (those
// collections are world-readable). If it can't be reached the build still
// succeeds with the static routes only.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const SITE_URL = 'https://anethanhvn.com';
const SHARE_IMAGE = `${SITE_URL}/og-image.jpg`;
const SITE_NAME = 'Cộng Đoàn Công Giáo Việt Nam Thánh Anê Lê Thị Thành';

// --- Vietnamese copy, read from the app's own translation table -------------
const langSrc = fs.readFileSync(path.join(root, 'src/contexts/LanguageContext.tsx'), 'utf8');
const lines = langSrc.split('\n');
const viStart = lines.findIndex((l) => /^ {2}vi: \{/.test(l));
const enStart = lines.findIndex((l) => /^ {2}en: \{/.test(l));
if (viStart === -1 || enStart === -1) {
  console.error('prerender: could not locate the vi/en translation blocks');
  process.exit(1);
}
const viBlock = lines.slice(viStart, enStart).join('\n');

function vi(key) {
  const m = viBlock.match(new RegExp(`'${key.replace(/\./g, '\\.')}':\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  return m ? m[1].replace(/\\'/g, "'").replace(/\\n/g, ' ') : undefined;
}

const DEFAULT_DESC = vi('home.description') || SITE_NAME;

const staticRoutes = [
  { path: '/', title: vi('home.title'), desc: vi('home.description') },
  { path: '/about', title: vi('about.title'), desc: vi('about.welcome') },
  { path: '/ministries', title: vi('ministries.title'), desc: DEFAULT_DESC },
  { path: '/events', title: vi('events.title'), desc: vi('events.subtitle') },
  { path: '/reflections', title: vi('reflections.title'), desc: vi('reflections.subtitle') },
  { path: '/gallery', title: vi('gallery.title'), desc: vi('gallery.subtitle') },
  { path: '/give', title: vi('give.title'), desc: vi('give.subtitle') },
  { path: '/contact', title: vi('contact.title'), desc: vi('contact.description') },
];

// --- Firestore (public REST) ------------------------------------------------
function projectId() {
  if (process.env.VITE_FIREBASE_PROJECT_ID) return process.env.VITE_FIREBASE_PROJECT_ID;
  try {
    const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
    return env.match(/^VITE_FIREBASE_PROJECT_ID=(.+)$/m)?.[1]?.trim();
  } catch {
    return undefined;
  }
}

function decode(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) {
    return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]));
  }
  return null;
}

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/** Mirrors src/lib/storage.ts: items live in a sub-collection or in one doc's `value`. */
async function loadList(project, name) {
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/site-data/${name}`;
  const items = [];
  let pageToken = '';
  do {
    const page = await getJson(`${base}/items?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`);
    for (const d of page?.documents || []) items.push(decode({ mapValue: { fields: d.fields } }));
    pageToken = page?.nextPageToken || '';
  } while (pageToken);
  if (items.length > 0) return items;

  const docData = await getJson(base);
  const value = docData?.fields?.value;
  return value ? decode(value) || [] : [];
}

async function loadDynamicRoutes() {
  const project = projectId();
  if (!project) {
    console.warn('prerender: no VITE_FIREBASE_PROJECT_ID, skipping events/reflections');
    return [];
  }
  const routes = [];
  const text = (t) => (t && (t.vi || t.en)) || '';
  const published = (it) => (it.status || 'published') === 'published';

  try {
    for (const e of (await loadList(project, 'events')).filter((it) => it && it.id && published(it))) {
      const name = text(e.name);
      if (!name) continue;
      routes.push({
        path: `/events/${encodeURIComponent(e.id)}`,
        title: name,
        desc: [name, e.date].filter(Boolean).join(' - '),
        lastmod: typeof e.date === 'string' ? e.date.slice(0, 10) : undefined,
      });
    }
  } catch (err) {
    console.warn(`prerender: events unavailable (${err.message})`);
  }

  try {
    for (const r of (await loadList(project, 'reflections')).filter((it) => it && it.id && published(it))) {
      const title = text(r.title);
      if (!title) continue;
      const plain = text(r.content).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      routes.push({
        path: `/reflections/${encodeURIComponent(r.id)}`,
        title,
        desc: plain ? `${plain.slice(0, 160)}${plain.length > 160 ? '...' : ''}` : DEFAULT_DESC,
        image: typeof r.thumbnail === 'string' && r.thumbnail.startsWith('https://') ? r.thumbnail : undefined,
        lastmod: typeof r.date === 'string' ? r.date.slice(0, 10) : undefined,
      });
    }
  } catch (err) {
    console.warn(`prerender: reflections unavailable (${err.message})`);
  }

  return routes;
}

// --- HTML -------------------------------------------------------------------
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

function render(route) {
  const url = route.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${route.path}`;
  const title = route.title === SITE_NAME ? SITE_NAME : `${route.title} | ${SITE_NAME}`;
  const desc = route.desc || DEFAULT_DESC;
  const image = route.image || SHARE_IMAGE;
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" data-rh="true" />`,
    `<link rel="canonical" href="${esc(url)}" data-rh="true" />`,
    `<meta property="og:title" content="${esc(title)}" data-rh="true" />`,
    `<meta property="og:description" content="${esc(desc)}" data-rh="true" />`,
    `<meta property="og:type" content="website" data-rh="true" />`,
    `<meta property="og:url" content="${esc(url)}" data-rh="true" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" data-rh="true" />`,
    `<meta property="og:locale" content="vi_VN" data-rh="true" />`,
    `<meta property="og:image" content="${esc(image)}" data-rh="true" />`,
    `<meta name="twitter:card" content="summary_large_image" data-rh="true" />`,
  ].join('\n    ');

  return template
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>\s*/, '')
    .replace('</head>', `    ${tags}\n  </head>`);
}

function write(route) {
  const dir = route.path === '/' ? dist : path.join(dist, ...route.path.split('/').filter(Boolean).map(decodeURIComponent));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), render(route));
}

function sitemap(routes) {
  const entries = routes.map((r) => {
    const loc = r.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${r.path}`;
    const lastmod = r.lastmod && /^\d{4}-\d{2}-\d{2}$/.test(r.lastmod) ? `<lastmod>${r.lastmod}</lastmod>` : '';
    return `  <url><loc>${esc(loc)}</loc>${lastmod}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

const dynamicRoutes = await loadDynamicRoutes();
const all = [...staticRoutes, ...dynamicRoutes];

// `template` was read once above, so overwriting dist/index.html (the "/" route) is safe.
for (const route of all) write(route);
fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap(all));

console.log(
  `prerender: wrote ${all.length} pages (${staticRoutes.length} static, ${dynamicRoutes.length} events/reflections) and sitemap.xml`
);
