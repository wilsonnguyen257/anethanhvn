import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { parseEventDate } from '../../lib/timezone';
import type { EventRegistration } from '../../types/event';

interface EventRegistrationFormProps {
  eventName: string;
  eventDate: string;
  eventTime: string;
  capacity?: number;
  registeredCount?: number;
  registrationDeadline?: string;
  onSubmit: (registration: Omit<EventRegistration, 'id' | 'registeredAt' | 'status' | 'eventId'>) => Promise<void>;
  loading?: boolean;
}

export default function EventRegistrationForm({
  eventName,
  eventDate,
  eventTime,
  capacity,
  registeredCount = 0,
  registrationDeadline,
  onSubmit,
  loading = false,
}: EventRegistrationFormProps) {
  const { language } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    numberOfPeople: 1,
    message: '',
  });

  const t = (en: string, vi: string) => language === 'vi' ? vi : en;

  // Check if registration is still open
  const isRegistrationOpen = () => {
    if (registrationDeadline) {
      return new Date() < new Date(registrationDeadline);
    }
    return true;
  };

  // Check if event is full
  const isEventFull = capacity && registeredCount >= capacity;

  // Available spots
  const availableSpots = capacity ? capacity - registeredCount : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isRegistrationOpen()) {
      alert(t('Registration has closed', 'Đã hết hạn đăng ký'));
      return;
    }

    if (isEventFull) {
      alert(t('Event is full', 'Sự kiện đã đầy'));
      return;
    }

    try {
      await onSubmit(formData);
      // Reset form on success
      setFormData({
        name: '',
        email: '',
        phone: '',
        numberOfPeople: 1,
        message: '',
      });
    } catch {
      // Error is handled by parent
    }
  };

  if (!isRegistrationOpen()) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
        <div className="text-slate-400 text-5xl mb-4">📅</div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          {t('Registration Closed', 'Đã Hết Đăng Ký')}
        </h3>
        <p className="text-slate-600">
          {t('Registration for this event has ended', 'Đã hết hạn đăng ký cho sự kiện này')}
        </p>
      </div>
    );
  }

  if (isEventFull) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
        <div className="text-slate-400 text-5xl mb-4">🚫</div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          {t('Event Full', 'Sự Kiện Đã Đầy')}
        </h3>
        <p className="text-slate-600">
          {t('All spots have been filled for this event', 'Tất cả chỗ đã được đăng ký cho sự kiện này')}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Event Info */}
      <div className="bg-slate-50 rounded-lg p-4">
        <h3 className="font-semibold text-slate-900 mb-2">
          {eventName}
        </h3>
        <div className="text-sm text-slate-600 space-y-1">
          <p>
            {t('Date', 'Ngày')}: {parseEventDate(eventDate).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <p>{t('Time', 'Thời gian')}: {eventTime}</p>
          {capacity && (
            <p>
              {t('Available spots', 'Chỗ còn lại')}: {availableSpots} / {capacity}
            </p>
          )}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {t('Full Name', 'Họ và Tên')} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={t('Enter your full name', 'Nhập họ và tên của bạn')}
          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {t('Email', 'Email')} <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder={t('Enter your email', 'Nhập email của bạn')}
          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {t('Phone Number', 'Số điện thoại')}
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder={t('Enter your phone number', 'Nhập số điện thoại của bạn')}
          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {/* Number of People */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {t('Number of People', 'Số lượng người')} <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          required
          min="1"
          max={availableSpots || undefined}
          value={formData.numberOfPeople}
          onChange={(e) => setFormData({ ...formData, numberOfPeople: parseInt(e.target.value) || 1 })}
          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
        {capacity && (
          <p className="text-xs text-slate-600 mt-1">
            {t('Maximum', 'Tối đa')}: {availableSpots} {t('people', 'người')}
          </p>
        )}
      </div>

      {/* Message */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          {t('Message (Optional)', 'Lời nhắn (không bắt buộc)')}
        </label>
        <textarea
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          placeholder={t('Any special requirements or notes', 'Yêu cầu đặc biệt hoặc ghi chú')}
          rows={4}
          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-3 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {t('Registering...', 'Đang đăng ký...')}
          </span>
        ) : (
          t('Register for Event', 'Đăng Ký Tham Gia')
        )}
      </button>

      {/* Privacy Note */}
      <p className="text-xs text-slate-600 text-center">
        {t(
          'By registering, you agree to receive event updates via email',
          'Bằng cách đăng ký, bạn đồng ý nhận thông tin cập nhật về sự kiện qua email'
        )}
      </p>
    </form>
  );
}
