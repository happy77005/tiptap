export interface CalendarDay {
  date: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
}

export interface MonthData {
  month: number;
  year: number;
  monthName: string;
  days: CalendarDay[][];
}

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function getMonthName(month: number): string {
  return MONTH_NAMES[month];
}

export function getWeekdayNames(): string[] {
  return WEEKDAY_NAMES;
}

export function generateMonthCalendar(year: number, month: number): MonthData {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const weeks: CalendarDay[][] = [];
  let currentWeek: CalendarDay[] = [];

  for (let i = 0; i < firstDayOfWeek; i++) {
    const prevMonthDate = new Date(year, month, 0 - (firstDayOfWeek - i - 1));
    currentWeek.push({
      date: prevMonthDate.getDate(),
      month: prevMonthDate.getMonth(),
      year: prevMonthDate.getFullYear(),
      isCurrentMonth: false
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push({
      date: day,
      month,
      year,
      isCurrentMonth: true
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    const remainingDays = 7 - currentWeek.length;
    for (let i = 1; i <= remainingDays; i++) {
      const nextMonthDate = new Date(year, month + 1, i);
      currentWeek.push({
        date: nextMonthDate.getDate(),
        month: nextMonthDate.getMonth(),
        year: nextMonthDate.getFullYear(),
        isCurrentMonth: false
      });
    }
    weeks.push(currentWeek);
  }

  return {
    month,
    year,
    monthName: getMonthName(month),
    days: weeks
  };
}

export function generateYearCalendar(year: number): MonthData[] {
  const months: MonthData[] = [];
  for (let month = 0; month < 12; month++) {
    months.push(generateMonthCalendar(year, month));
  }
  return months;
}
