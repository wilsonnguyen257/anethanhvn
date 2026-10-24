import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const SITE_URL = 'https://anethanhvn.com';
const SHARE_IMAGE = `${SITE_URL}/logo.png`;

interface SEOProps {
  title: string;
  description?: string;
  noindex?: boolean;
}

export default function SEO({ title, description, noindex }: SEOProps) {
  const { language } = useLanguage();
  const { pathname } = useLocation();
  const url = `${SITE_URL}${pathname === '/' ? '/' : pathname.replace(/\/$/, '')}`;

  const siteName = language === 'vi' ? 'Cộng Đoàn Công Giáo Việt Nam Thánh Anê Lê Thị Thành' : 'Vietnamese Catholic Community St Ane Le Thi Thanh';
  const defaultDesc = language === 'vi' 
    ? 'Chào mừng đến với Cộng Đoàn Công Giáo Việt Nam Thánh Anê Lê Thị Thành.' 
    : 'Welcome to the Vietnamese Catholic Community St Ane Le Thi Thanh.';
  const fullTitle = `${title} | ${siteName}`;

  return (
    <Helmet htmlAttributes={{ lang: language }}>
      <title>{fullTitle}</title>
      {!noindex && <link rel="canonical" href={url} />}
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={language === 'vi' ? 'vi_VN' : 'en_AU'} />
      <meta property="og:image" content={SHARE_IMAGE} />
      <meta name="twitter:card" content="summary" />
      <meta name="description" content={description || defaultDesc} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description || defaultDesc} />
      <meta property="og:type" content="website" />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
    </Helmet>
  );
}
