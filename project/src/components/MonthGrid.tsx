import { MonthData, getWeekdayNames } from '../utils/calendar';

interface MonthGridProps {
  monthData: MonthData;
}

export default function MonthGrid({ monthData }: MonthGridProps) {
  const weekdays = getWeekdayNames();

  return (
    <div className="month-container">
      <div className="month-header">
        {monthData.monthName}
      </div>

      <div className="weekday-header">
        {weekdays.map((day) => (
          <div key={day} className="weekday-cell">
            {day}
          </div>
        ))}
      </div>

      <div className="days-grid">
        {monthData.days.map((week, weekIndex) => (
          <div key={weekIndex} className="week-row">
            {week.map((day, dayIndex) => (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className={`day-cell ${!day.isCurrentMonth ? 'other-month' : ''} ${dayIndex === 0 ? 'sunday' : ''}`}
              >
                {day.date}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
