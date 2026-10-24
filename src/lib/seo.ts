import { parseEventTime } from './timezone';
import type { Language } from './locale';

export const SITE_URL = 'https://anethanhvn.com';
export const SHARE_IMAGE = `${SITE_URL}/og-image.jpg`;

const ORGANIZATION = {
  '@type': 'Organization',
  name: 'Cộng Đoàn Công Giáo Việt Nam Anê Thành',
  url: `${SITE_URL}/`,
};

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * schema.org Event for an event detail page. startDate is Melbourne wall-clock
 * time without an offset (schema.org allows that), since the offset changes
 * with daylight saving.
 */
export function buildEventJsonLd(input: {
  name: string;
  description: string;
  date: string; // yyyy-mm-dd
  time?: string; // e.g. '5:00 PM'
  location?: string;
  image?: string;
  url: string;
  language: Language;
}): Record<string, unknown> {
  let startDate = input.date;
  if (input.time && /\d/.test(input.time)) {
    const { hours, minutes } = parseEventTime(input.time);
    startDate = `${input.date}T${pad(hours)}:${pad(minutes)}`;
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: input.name,
    description: input.description,
    startDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    ...(input.location ? { location: { '@type': 'Place', name: input.location, address: input.location } } : {}),
    ...(input.image ? { image: [input.image] } : {}),
    organizer: ORGANIZATION,
    inLanguage: input.language,
    url: input.url,
  };
}

/** schema.org Article for a reflection detail page. */
export function buildArticleJsonLd(input: {
  headline: string;
  description: string;
  date?: string; // yyyy-mm-dd
  author?: string;
  image?: string;
  url: string;
  language: Language;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    ...(input.date ? { datePublished: input.date } : {}),
    ...(input.author ? { author: { '@type': 'Person', name: input.author } } : {}),
    image: [input.image || SHARE_IMAGE],
    inLanguage: input.language,
    mainEntityOfPage: input.url,
    publisher: { ...ORGANIZATION, logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` } },
  };
}
