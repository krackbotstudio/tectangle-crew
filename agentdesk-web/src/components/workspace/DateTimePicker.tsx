import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Calendar } from "lucide-react";
import { cn } from "../../lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalDatetimeValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseTimePartsFixed(iso: string | null | undefined) {
  const base = iso ? new Date(iso) : new Date();
  const valid = !Number.isNaN(base.getTime()) ? base : new Date();
  let h24 = valid.getHours();
  const ampm: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  let hour12 = h24 % 12;
  if (hour12 === 0) hour12 = 12;
  return {
    date: new Date(valid.getFullYear(), valid.getMonth(), valid.getDate()),
    hour12,
    minute: valid.getMinutes(),
    ampm,
  };
}

function combineDateTime(
  date: Date,
  hour12: number,
  minute: number,
  ampm: "AM" | "PM"
): string {
  const d = new Date(date);
  const h24 = ampm === "AM" ? (hour12 === 12 ? 0 : hour12) : hour12 === 12 ? 12 : hour12 + 12;
  d.setHours(h24, minute, 0, 0);
  return d.toISOString();
}

export function isoToDatetimeLocal(iso: string | null | undefined): string {
  return toLocalDatetimeValue(iso);
}

export function datetimeLocalToIso(local: string): string | null {
  return fromLocalDatetimeValue(local);
}

export function DateTimePicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (localDatetime: string) => void;
  className?: string;
}) {
  const initial = parseTimePartsFixed(value ? fromLocalDatetimeValue(value) ?? value : null);
  const [viewMonth, setViewMonth] = useState(() => initial.date.getMonth());
  const [viewYear, setViewYear] = useState(() => initial.date.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date>(() => initial.date);
  const [hour12, setHour12] = useState(initial.hour12);
  const [minute, setMinute] = useState(initial.minute);
  const [ampm, setAmpm] = useState<"AM" | "PM">(initial.ampm);

  const calendarDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(viewYear, viewMonth, d));
    }
    return cells;
  }, [viewMonth, viewYear]);

  function emit(date: Date, h: number, m: number, ap: "AM" | "PM") {
    const iso = combineDateTime(date, h, m, ap);
    onChange(toLocalDatetimeValue(iso));
  }

  function selectDay(day: Date) {
    setSelectedDate(day);
    emit(day, hour12, minute, ampm);
  }

  function updateTime(h: number, m: number, ap: "AM" | "PM") {
    setHour12(h);
    setMinute(m);
    setAmpm(ap);
    emit(selectedDate, h, m, ap);
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  }

  const today = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div className={cn("rounded-xl border border-border bg-panel-elevated p-3", className)}>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
              <Calendar className="h-3.5 w-3.5" />
              Date
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="rounded-lg p-1 hover:bg-panel-hover"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[8rem] text-center text-sm font-medium text-text-strong">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="rounded-lg p-1 hover:bg-panel-hover"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-text-faint">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1 font-medium">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((day, i) =>
              day ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    "aspect-square rounded-lg text-xs transition",
                    isSameDay(day, selectedDate)
                      ? "bg-accent-light font-semibold text-accent-fg"
                      : isSameDay(day, today)
                        ? "border border-border text-text-strong hover:bg-panel-hover"
                        : "text-text-muted hover:bg-panel-hover hover:text-text-strong"
                  )}
                >
                  {day.getDate()}
                </button>
              ) : (
                <div key={i} />
              )
            )}
          </div>
        </div>

        <div className="sm:border-l sm:border-border sm:pl-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted">
            <Clock className="h-3.5 w-3.5" />
            Time
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] text-text-faint">Hour</span>
              <select
                value={hour12}
                onChange={(e) => updateTime(Number(e.target.value), minute, ampm)}
                className="rounded-lg border border-border bg-panel px-2 py-2 text-sm text-text"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
            <span className="pb-2 text-lg text-text-faint">:</span>
            <label className="block">
              <span className="mb-1 block text-[10px] text-text-faint">Min</span>
              <select
                value={minute}
                onChange={(e) => updateTime(hour12, Number(e.target.value), ampm)}
                className="rounded-lg border border-border bg-panel px-2 py-2 text-sm text-text"
              >
                {minutes.map((m) => (
                  <option key={m} value={m}>
                    {pad(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] text-text-faint">&nbsp;</span>
              <select
                value={ampm}
                onChange={(e) => updateTime(hour12, minute, e.target.value as "AM" | "PM")}
                className="rounded-lg border border-border bg-panel px-2 py-2 text-sm text-text"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </label>
          </div>
          {value && (
            <p className="mt-3 text-[11px] text-text-muted">
              {new Date(fromLocalDatetimeValue(value) ?? value).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
