import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { withLanguagePrefix } from '../lib/locale';
import { SITE_URL, SHARE_IMAGE } from '../lib/seo';

interface SEOProps {
  title: string;
  description?: string;
  noindex?: boolean;
  /** Absolute URL of the page's share image; defaults to the site card. */
  image?: string;
  /** schema.org JSON-LD for the page (Event, Article, ...). */
  jsonLd?: Record<string, unknown>;
}

export default function SEO({ title, description, noindex, image, jsonLd }: SEOProps) {
  const { language } = useLanguage();
  // useLocation().pathname excludes the /en basename, so it's the same page in both languages.
  const { pathname } = useLocation();
  const path = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  const viUrl = `${SITE_URL}${path}`;
  const enUrl = `${SITE_URL}${withLanguagePrefix(path, 'en')}`;
  const url = language === 'en' ? enUrl : viUrl;

  const siteName = language === 'vi' ? 'Cộng Đoàn Công Giáo Việt Nam Thánh Anê Lê Thị Thành' : 'Vietnamese Catholic Community St Ane Le Thi Thanh';
  const defaultDesc = language === 'vi'
    ? 'Chào mừng đến với Cộng Đoàn Công Giáo Việt Nam Thánh Anê Lê Thị Thành.'
    : 'Welcome to the Vietnamese Catholic Community St Ane Le Thi Thanh.';
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;

  return (
    <Helmet htmlAttributes={{ lang: language }}>
      <title>{fullTitle}</title>
      {!noindex && <link rel="canonical" href={url} />}
      {!noindex && <link rel="alternate" hrefLang="vi" href={viUrl} />}
      {!noindex && <link rel="alternate" hrefLang="en" href={enUrl} />}
      {!noindex && <link rel="alternate" hrefLang="x-default" href={viUrl} />}
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={language === 'vi' ? 'vi_VN' : 'en_AU'} />
      <meta property="og:image" content={image || SHARE_IMAGE} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="description" content={description || defaultDesc} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description || defaultDesc} />
      <meta property="og:type" content="website" />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}
