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

export interface YearMonthOption {
  key: string; // "YYYY-MM"
  label: string; // "ตุลาคม 2569"
  year: number;
  monthIndex: number;
  yearBE: number;
}

export function getAcademicYearMonths(activeYear?: {
  term1Start?: string;
  term1End?: string;
  term2Start?: string;
  term2End?: string;
  name?: string;
}): YearMonthOption[] {
  const results: YearMonthOption[] = [];
  const seen = new Set<string>();

  const addRange = (startStr?: string, endStr?: string) => {
    if (!startStr || !endStr) return;
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cur <= last) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;

      if (!seen.has(key)) {
        seen.add(key);
        const yearBE = y + 543;
        results.push({
          key,
          label: `${THAI_MONTHS_FULL[m]} ${yearBE}`,
          year: y,
          monthIndex: m,
          yearBE
        });
      }
      cur.setMonth(cur.getMonth() + 1);
    }
  };

  if (activeYear?.term1Start && activeYear?.term1End) {
    addRange(activeYear.term1Start, activeYear.term1End);
  }
  if (activeYear?.term2Start && activeYear?.term2End) {
    addRange(activeYear.term2Start, activeYear.term2End);
  }
  if (results.length === 0 && activeYear?.term1Start && activeYear?.term2End) {
    addRange(activeYear.term1Start, activeYear.term2End);
  }

  // Fallback to 12 months of the academic year or current year
  if (results.length === 0) {
    const baseYearBE = activeYear?.name && !isNaN(Number(activeYear.name))
      ? Number(activeYear.name)
      : new Date().getFullYear() + 543;
    const baseYearCE = baseYearBE - 543;

    // Academic year in Thailand usually starts in May (month 4) and ends in March or April next year
    // or standard calendar months:
    for (let m = 0; m < 12; m++) {
      const key = `${baseYearCE}-${String(m + 1).padStart(2, '0')}`;
      results.push({
        key,
        label: `${THAI_MONTHS_FULL[m]} ${baseYearBE}`,
        year: baseYearCE,
        monthIndex: m,
        yearBE: baseYearBE
      });
    }
  }

  return results;
}

