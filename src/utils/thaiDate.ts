import { DayOfWeek } from '../types';

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export const THAI_DAYS: { [key: number]: DayOfWeek | null } = {
  1: 'จันทร์',
  2: 'อังคาร',
  3: 'พุธ',
  4: 'พฤหัสบดี',
  5: 'ศุกร์',
  0: null, // Sunday
  6: null  // Saturday
};

export const DAY_ORDER: DayOfWeek[] = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];

export function formatToThaiBE(dateInput: string | Date, isShort: boolean = true): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  
  const day = d.getDate();
  const monthIdx = d.getMonth();
  const yearBE = d.getFullYear() + 543;
  const monthName = isShort ? THAI_MONTHS_SHORT[monthIdx] : THAI_MONTHS_FULL[monthIdx];

  return `${day} ${monthName} ${yearBE}`;
}

export function formatThaiFullDate(dateInput: string | Date): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  
  const day = d.getDate();
  const dayNum = d.getDay();
  const dayName = THAI_DAYS[dayNum] || (dayNum === 0 ? 'อาทิตย์' : 'เสาร์');
  const monthName = THAI_MONTHS_FULL[d.getMonth()];
  const yearBE = d.getFullYear() + 543;

  return `วัน${dayName}ที่ ${day} ${monthName} พ.ศ. ${yearBE}`;
}

export function getDayOfWeekFromDate(dateStr: string): DayOfWeek | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return THAI_DAYS[d.getDay()] || null;
  }
  const d = new Date(dateStr);
  return THAI_DAYS[d.getDay()] || null;
}

export function getTodayISODate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
