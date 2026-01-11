import { forwardRef } from 'react';
import MonthGrid from './MonthGrid';
import { MonthData } from '../utils/calendar';

interface CalendarViewProps {
  year: number;
  months: MonthData[];
}

const CalendarView = forwardRef<HTMLDivElement, CalendarViewProps>(
  ({ year, months }, ref) => {
    return (
      <div ref={ref} className="calendar-view">
        <div className="year-title">{year}</div>

        <div className="months-grid">
          {months.map((monthData) => (
            <MonthGrid key={monthData.month} monthData={monthData} />
          ))}
        </div>
      </div>
    );
  }
);

CalendarView.displayName = 'CalendarView';

export default CalendarView;
