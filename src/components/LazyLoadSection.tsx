import { useState, useRef, useEffect, type ReactNode } from 'react';

interface LazyLoadSectionProps {
  children: ReactNode;
  placeholderHeight?: string;
}

const LazyLoadSection = ({ children, placeholderHeight = '500px' }: LazyLoadSectionProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const placeholderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '0px 0px 200px 0px', // Start loading 200px before it enters the viewport
      }
    );

    const el = placeholderRef.current;
    if (el) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={placeholderRef} style={{ minHeight: isVisible ? 'auto' : placeholderHeight }}>
      {isVisible ? children : null}
    </div>
  );
};

export default LazyLoadSection;
