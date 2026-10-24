// Post-build step: give every public route its own index.html, in both
// languages, with correct <title>, description, canonical, hreflang, Open Graph
// tags and (for events and reflections) schema.org JSON-LD baked in, and
// rebuild sitemap.xml.
//
// The site is a client-rendered SPA, so crawlers and link-preview bots that
// don't run JavaScript only ever see index.html's defaults. Writing
// dist/<route>/index.html (Vietnamese) and dist/en/<route>/index.html
// (English) fixes that without changing how the app runs: the same scripts
// load, React Router renders the route, and react-helmet-async replaces these
// tags (they carry data-rh) as soon as the page hydrates.
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
const LANGS = ['vi', 'en'];
const SITE_NAME = {
  vi: 'Cộng Đoàn Công Giáo Việt Nam Thánh Anê Lê Thị Thành',
  en: 'Vietnamese Catholic Community St Ane Le Thi Thanh',
};
const OG_LOCALE = { vi: 'vi_VN', en: 'en_AU' };
const ORGANIZATION = { '@type': 'Organization', name: 'Cộng Đoàn Công Giáo Việt Nam Anê Thành', url: `${SITE_URL}/` };

// URL for a page in a language: Vietnamese is the unprefixed default.
const urlFor = (routePath, lang) => {
  if (lang === 'vi') return routePath === '/' ? `${SITE_URL}/` : `${SITE_URL}${routePath}`;
  return routePath === '/' ? `${SITE_URL}/en/` : `${SITE_URL}/en${routePath}`;
};

// --- Copy, read from the app's own translation table ------------------------
const langSrc = fs.readFileSync(path.join(root, 'src/contexts/LanguageContext.tsx'), 'utf8');
const lines = langSrc.split('\n');
const viStart = lines.findIndex((l) => /^ {2}vi: \{/.test(l));
const enStart = lines.findIndex((l) => /^ {2}en: \{/.test(l));
const enEnd = lines.findIndex((l, i) => i > enStart && /^\};?$/.test(l));
if (viStart === -1 || enStart === -1 || enEnd === -1) {
  console.error('prerender: could not locate the vi/en translation blocks');
  process.exit(1);
}
const blocks = {
  vi: lines.slice(viStart, enStart).join('\n'),
  en: lines.slice(enStart, enEnd).join('\n'),
};

function tr(lang, key) {
  const m = blocks[lang].match(new RegExp(`'${key.replace(/\./g, '\\.')}':\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  return m ? m[1].replace(/\\'/g, "'").replace(/\\n/g, ' ') : undefined;
}

const defaultDesc = (lang) => tr(lang, 'home.description') || SITE_NAME[lang];

// Static pages: [path, title key, description key (omit for the site default)]
const staticPages = [
  ['/', 'home.title', 'home.description'],
  ['/about', 'about.title', 'about.welcome'],
  ['/ministries', 'ministries.title'],
  ['/events', 'events.title', 'events.subtitle'],
  ['/reflections', 'reflections.title', 'reflections.subtitle'],
  ['/gallery', 'gallery.title', 'gallery.subtitle'],
  ['/give', 'give.title', 'give.subtitle'],
  ['/contact', 'contact.title', 'contact.description'],
];

const staticRoutes = staticPages.map(([routePath, titleKey, descKey]) => ({
  path: routePath,
  title: (lang) => tr(lang, titleKey),
  desc: (lang) => (descKey && tr(lang, descKey)) || defaultDesc(lang),
}));

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

// Pick the visitor's language, falling back to the other one (as the app does).
const pick = (t, lang) => (t && (t[lang] || t[lang === 'vi' ? 'en' : 'vi'])) || '';
const plainText = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const pad = (n) => String(n).padStart(2, '0');

/** "5:00 PM" or "17:00" -> "T17:00"; empty string when unparseable. */
function timeSuffix(time) {
  const m = String(time || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return '';
  let hours = parseInt(m[1], 10);
  const meridiem = m[3]?.toUpperCase();
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  else if (meridiem === 'AM' && hours === 12) hours = 0;
  return `T${pad(hours)}:${m[2]}`;
}

// Keep these two builders in step with src/lib/seo.ts.
function eventJsonLd(e, lang, name, description, url, image) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    description,
    startDate: `${e.date}${timeSuffix(e.time)}`,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    ...(e.location ? { location: { '@type': 'Place', name: e.location, address: e.location } } : {}),
    ...(image ? { image: [image] } : {}),
    organizer: ORGANIZATION,
    inLanguage: lang,
    url,
  };
}

function articleJsonLd(r, lang, headline, description, url, image) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    ...(r.date ? { datePublished: String(r.date).slice(0, 10) } : {}),
    ...(r.author ? { author: { '@type': 'Person', name: r.author } } : {}),
    image: [image || SHARE_IMAGE],
    inLanguage: lang,
    mainEntityOfPage: url,
    publisher: { ...ORGANIZATION, logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` } },
  };
}

async function loadDynamicRoutes() {
  const project = projectId();
  if (!project) {
    console.warn('prerender: no VITE_FIREBASE_PROJECT_ID, skipping events/reflections');
    return [];
  }
  const routes = [];
  // Ids become directory names, so only accept ones that can't be '..' or contain separators.
  const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;
  const published = (it) => it && SAFE_ID.test(String(it.id)) && (it.status || 'published') === 'published';
  const image = (it) => {
    const u = it.thumbnailFull || it.thumbnail;
    return typeof u === 'string' && u.startsWith('https://') ? u : undefined;
  };

  try {
    for (const e of (await loadList(project, 'events')).filter(published)) {
      if (!pick(e.name, 'vi')) continue;
      const routePath = `/events/${encodeURIComponent(e.id)}`;
      routes.push({
        path: routePath,
        lastmod: typeof e.date === 'string' ? e.date.slice(0, 10) : undefined,
        title: (lang) => pick(e.name, lang),
        desc: (lang) => [pick(e.name, lang), e.date].filter(Boolean).join(' - '),
        image: image(e),
        jsonLd: (lang) => {
          const name = pick(e.name, lang);
          const body = plainText(pick(e.content, lang)).slice(0, 300);
          return eventJsonLd(e, lang, name, body || [name, e.date].filter(Boolean).join(' - '), urlFor(routePath, lang), image(e));
        },
      });
    }
  } catch (err) {
    console.warn(`prerender: events unavailable (${err.message})`);
  }

  try {
    for (const r of (await loadList(project, 'reflections')).filter(published)) {
      if (!pick(r.title, 'vi')) continue;
      const routePath = `/reflections/${encodeURIComponent(r.id)}`;
      const excerpt = (lang) => {
        const plain = plainText(pick(r.content, lang));
        return plain ? `${plain.slice(0, 160)}${plain.length > 160 ? '...' : ''}` : defaultDesc(lang);
      };
      routes.push({
        path: routePath,
        lastmod: typeof r.date === 'string' ? r.date.slice(0, 10) : undefined,
        title: (lang) => pick(r.title, lang),
        desc: excerpt,
        image: image(r),
        jsonLd: (lang) =>
          articleJsonLd(r, lang, pick(r.title, lang), plainText(pick(r.content, lang)).slice(0, 160), urlFor(routePath, lang), image(r)),
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

function render(route, lang) {
  const url = urlFor(route.path, lang);
  const siteName = SITE_NAME[lang];
  const pageTitle = route.title(lang) || siteName;
  const title = pageTitle.includes(siteName) ? pageTitle : `${pageTitle} | ${siteName}`;
  const desc = route.desc(lang) || defaultDesc(lang);
  const image = route.image || SHARE_IMAGE;
  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" data-rh="true" />`,
    `<link rel="canonical" href="${esc(url)}" data-rh="true" />`,
    `<link rel="alternate" hreflang="vi" href="${esc(urlFor(route.path, 'vi'))}" data-rh="true" />`,
    `<link rel="alternate" hreflang="en" href="${esc(urlFor(route.path, 'en'))}" data-rh="true" />`,
    `<link rel="alternate" hreflang="x-default" href="${esc(urlFor(route.path, 'vi'))}" data-rh="true" />`,
    `<meta property="og:title" content="${esc(title)}" data-rh="true" />`,
    `<meta property="og:description" content="${esc(desc)}" data-rh="true" />`,
    `<meta property="og:type" content="website" data-rh="true" />`,
    `<meta property="og:url" content="${esc(url)}" data-rh="true" />`,
    `<meta property="og:site_name" content="${esc(siteName)}" data-rh="true" />`,
    `<meta property="og:locale" content="${OG_LOCALE[lang]}" data-rh="true" />`,
    `<meta property="og:image" content="${esc(image)}" data-rh="true" />`,
    `<meta name="twitter:card" content="summary_large_image" data-rh="true" />`,
  ];
  if (route.jsonLd) {
    const json = JSON.stringify(route.jsonLd(lang)).replace(/</g, '\\u003c');
    tags.push(`<script type="application/ld+json" data-rh="true">${json}</script>`);
  }

  return template
    .replace('<html lang="vi">', `<html lang="${lang}">`)
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[^>]*>\s*/, '')
    .replace('</head>', `    ${tags.join('\n    ')}\n  </head>`);
}

function write(route, lang) {
  const segments = route.path.split('/').filter(Boolean);
  const dir = path.resolve(dist, ...(lang === 'en' ? ['en'] : []), ...segments);
  // Belt and braces: never write outside dist/, whatever the route path contains.
  if (dir !== dist && !dir.startsWith(dist + path.sep)) {
    throw new Error(`prerender: refusing to write outside dist: ${route.path}`);
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), render(route, lang));
}

function sitemap(routes) {
  const entries = [];
  for (const r of routes) {
    const alternates = [
      `<xhtml:link rel="alternate" hreflang="vi" href="${esc(urlFor(r.path, 'vi'))}"/>`,
      `<xhtml:link rel="alternate" hreflang="en" href="${esc(urlFor(r.path, 'en'))}"/>`,
      `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(urlFor(r.path, 'vi'))}"/>`,
    ].join('');
    const lastmod = r.lastmod && /^\d{4}-\d{2}-\d{2}$/.test(r.lastmod) ? `<lastmod>${r.lastmod}</lastmod>` : '';
    for (const lang of LANGS) {
      entries.push(`  <url><loc>${esc(urlFor(r.path, lang))}</loc>${lastmod}${alternates}</url>`);
    }
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    `${entries.join('\n')}\n</urlset>\n`
  );
}

const dynamicRoutes = await loadDynamicRoutes();
const all = [...staticRoutes, ...dynamicRoutes];

// `template` was read once above, so overwriting dist/index.html (the "/" route) is safe.
for (const route of all) for (const lang of LANGS) write(route, lang);
fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap(all));

console.log(
  `prerender: wrote ${all.length * LANGS.length} pages (${all.length} routes x ${LANGS.length} languages; ` +
    `${dynamicRoutes.length} events/reflections) and sitemap.xml`
);
