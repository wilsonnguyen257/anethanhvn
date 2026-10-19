export interface RecurrenceRule {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endDate?: string;
  occurrences?: number;
}

export interface EnhancedEvent {
  id: string;
  name: {
    en: string;
    vi: string;
  };
  description?: {
    en: string;
    vi: string;
  };
  date: string;
  time: string;
  endTime?: string;
  location: string;
  locationUrl?: string;
  thumbnail?: string;
  capacity?: number;
  registrationEnabled: boolean;
  registrationDeadline?: string;
  recurrence?: RecurrenceRule;
  isRecurring: boolean;
  reminders: unknown[];
  tags?: string[];
  category?: string;
  timezone: string;
  onlineEventUrl?: string;
  contactInfo?: {
    email: string;
    phone: string;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventFormData {
  id: string | null;
  name: {
    en: string;
    vi: string;
  };
  description: {
    en: string;
    vi: string;
  };
  date: string;
  time: string;
  endTime: string;
  location: string;
  locationUrl: string;
  thumbnail: string;
  capacity: number | undefined;
  registrationEnabled: boolean;
  registrationDeadline: string;
  recurrence?: RecurrenceRule;
  isRecurring: boolean;
  reminders: unknown[];
  tags: string[];
  category: string;
  onlineEventUrl: string;
  contactInfo: {
    email: string;
    phone: string;
  };
}

export interface EventRegistration {
  id: string;
  eventId: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  registeredAt: string;
  status?: 'confirmed' | 'pending' | 'cancelled' | string;
}