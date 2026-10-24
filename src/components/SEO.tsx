import { Helmet } from 'react-helmet-async';
import { useLanguage } from '../contexts/LanguageContext';

interface SEOProps {
  title: string;
  description?: string;
  noindex?: boolean;
}

export default function SEO({ title, description, noindex }: SEOProps) {
  const { language } = useLanguage();
  
  const siteName = language === 'vi' ? 'Cộng Đoàn Công Giáo Việt Nam Thánh Anê Lê Thị Thành' : 'Vietnamese Catholic Community St Ane Le Thi Thanh';
  const defaultDesc = language === 'vi' 
    ? 'Chào mừng đến với Cộng Đoàn Công Giáo Việt Nam Thánh Anê Lê Thị Thành.' 
    : 'Welcome to the Vietnamese Catholic Community St Ane Le Thi Thanh.';
  const fullTitle = `${title} | ${siteName}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description || defaultDesc} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description || defaultDesc} />
      <meta property="og:type" content="website" />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
    </Helmet>
  );
}
