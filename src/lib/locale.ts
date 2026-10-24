// The site's language lives in the URL: /en/... is English, every other path
// is Vietnamese (the default, so existing links keep working).

export type Language = 'vi' | 'en';

const EN_PREFIX = '/en';

export function languageFromPath(pathname: string): Language {
  return pathname === EN_PREFIX || pathname.startsWith(`${EN_PREFIX}/`) ? 'en' : 'vi';
}

/** '/en/about' -> '/about', '/en' -> '/', anything else unchanged. */
export function stripLanguagePrefix(pathname: string): string {
  if (pathname === EN_PREFIX || pathname === `${EN_PREFIX}/`) return '/';
  return pathname.startsWith(`${EN_PREFIX}/`) ? pathname.slice(EN_PREFIX.length) : pathname;
}

/** Path for a page in the given language: ('/about', 'en') -> '/en/about'. */
export function withLanguagePrefix(pathname: string, language: Language): string {
  const base = stripLanguagePrefix(pathname);
  if (language === 'vi') return base;
  return base === '/' ? `${EN_PREFIX}/` : `${EN_PREFIX}${base}`;
}
