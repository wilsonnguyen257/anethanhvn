import { Link } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import SEO from "../components/SEO";

export default function NotFound() {
  const { language } = useLanguage();

  const links = [
    { name: language === 'vi' ? 'Sự kiện' : 'Events', path: '/events', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { name: language === 'vi' ? 'Giới thiệu' : 'About', path: '/about', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { name: language === 'vi' ? 'Thư viện ảnh' : 'Gallery', path: '/gallery', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { name: language === 'vi' ? 'Dâng cúng' : 'Give', path: '/give', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  ];

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-16">
      <SEO title={language === 'vi' ? 'Không tìm thấy trang' : 'Page not found'} noindex />
      <div className="max-w-2xl mx-auto text-center">
        <div className="card !p-12">
          <p className="font-serif font-bold text-7xl md:text-8xl text-brand-600 mb-4">404</p>
          <h1 className="h2 mb-4">
            {language === 'vi' ? 'Không tìm thấy trang' : 'Page not found'}
          </h1>
          <p className="text-slate-600 mb-8 max-w-md mx-auto leading-relaxed">
            {language === 'vi'
              ? 'Trang anh chị em tìm không có ở đây. Có thể đường dẫn đã thay đổi hoặc trang đã bị gỡ.'
              : "The page you're looking for isn't here. It may have moved or been removed."}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/" className="btn btn-primary">
              {language === 'vi' ? 'Về trang chủ' : 'Back to home'}
            </Link>
            <Link to="/contact" className="btn btn-outline">
              {language === 'vi' ? 'Liên hệ' : 'Contact us'}
            </Link>
          </div>
        </div>

        {/* Helpful links */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="group card flex flex-col items-center gap-2 !p-4"
            >
              <svg className="w-6 h-6 text-slate-400 group-hover:text-brand-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={link.icon} />
              </svg>
              <p className="text-sm font-semibold text-slate-600 group-hover:text-brand-600 transition-colors">{link.name}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
