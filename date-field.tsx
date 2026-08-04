import * as React from "react";
import { CalendarIcon, ChevronDownIcon, CheckIcon } from "lucide-react";
import { id as idLocale } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import type { DropdownProps } from "react-day-picker";
import { cn } from "@/lib/utils.ts";

/**
 * A date input that supports BOTH manual typing (dd/mm/yyyy) and a calendar
 * popover. The calendar uses month + year dropdowns so the year can be edited
 * directly, which is ideal for dates like birthdays that can be decades in the
 * past.
 *
 * Value is stored/emitted as an ISO date string ("YYYY-MM-DD") to stay
 * compatible with the rest of the app, or "" when empty.
 */
type DateFieldProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  fromYear?: number;
  toYear?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Optional minimum selectable date as ISO "YYYY-MM-DD". */
  min?: string;
  /** Optional maximum selectable date as ISO "YYYY-MM-DD". */
  max?: string;
};

/** Converts an ISO "YYYY-MM-DD" string to a "dd/mm/yyyy" display string. */
function isoToDisplay(iso?: string): string {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

/** Parses a "dd/mm/yyyy" (or "d-m-yyyy") display string into ISO, or null. */
function displayToIso(text: string): string | null {
  const cleaned = text.trim().replace(/[.\-\s]/g, "/");
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cleaned);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  // Validate the real calendar date (rejects e.g. 31/02/2020).
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Parses an ISO string into a Date (local), or undefined. */
function isoToDate(iso?: string): Date | undefined {
  if (!iso) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

/**
 * Derives the month the calendar should show from partial "dd/mm/yyyy" text as
 * the user types. Uses the month + year segments as soon as they are valid, so
 * the calendar navigates to follow what is being entered. Returns undefined
 * when there is not enough information yet.
 */
function partialToMonth(text: string): Date | undefined {
  const cleaned = text.trim().replace(/[.\-\s]/g, "/");
  const segments = cleaned.split("/");
  const monthRaw = segments[1] ?? "";
  const yearRaw = segments[2] ?? "";

  const month = Number(monthRaw);
  const hasMonth = monthRaw !== "" && month >= 1 && month <= 12;
  const hasYear = /^\d{4}$/.test(yearRaw);

  if (hasYear && hasMonth) return new Date(Number(yearRaw), month - 1, 1);
  if (hasYear) return new Date(Number(yearRaw), 0, 1);
  if (hasMonth) return new Date(new Date().getFullYear(), month - 1, 1);
  return undefined;
}

function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/**
 * Custom dropdown for the calendar's month/year selectors. Rendered as a simple
 * inline (absolutely-positioned) list instead of a nested Radix Popover, which
 * avoids focus-trapping conflicts that made the trigger unresponsive. The list
 * is fixed to ~5 visible rows with a native scrollbar and auto-scrolls to the
 * current value when opened.
 */
function CalendarDropdown({ value, options, onChange }: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const selectedRef = React.useRef<HTMLButtonElement>(null);

  const opts = options ?? [];
  const selected = opts.find((o) => String(o.value) === String(value));

  const handleSelect = (next: string | number) => {
    if (onChange) {
      onChange({
        target: { value: String(next) },
      } as React.ChangeEvent<HTMLSelectElement>);
    }
    setOpen(false);
  };

  // Center the currently-selected row when the list opens.
  React.useEffect(() => {
    if (open && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "center" });
    }
  }, [open]);

  // Close when clicking outside the dropdown.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="h-7 gap-1 px-2 text-sm font-medium"
      >
        {selected?.label ?? String(value)}
        <ChevronDownIcon className="size-3.5 opacity-60" />
      </Button>
      {open && (
        <div
          data-calendar-dropdown=""
          className="absolute left-1/2 top-full z-50 mt-1 min-w-[7rem] -translate-x-1/2 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {/* Tinggi tetap = 5 baris * 2rem; scrollbar selalu tampil. */}
          <div
            className="always-scrollbar h-[10rem] overflow-y-scroll"
            onWheel={(e) => {
              // Salurkan gerakan roda mouse langsung ke daftar dan cegah
              // popover kalender induk menelan event scroll.
              e.stopPropagation();
              e.currentTarget.scrollTop += e.deltaY;
            }}
          >
            {opts.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={opt.value}
                  ref={isSelected ? selectedRef : undefined}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    "flex h-8 w-full cursor-pointer items-center justify-between rounded-sm px-2 text-sm outline-none",
                    "hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent/60 font-medium",
                    opt.disabled && "pointer-events-none opacity-50",
                  )}
                >
                  {opt.label}
                  {isSelected && <CheckIcon className="size-4" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function DateField({
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
  fromYear = 1940,
  toYear = new Date().getFullYear() + 5,
  disabled,
  className,
  id,
  min,
  max,
}: DateFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(isoToDisplay(value));
  // Controlled calendar month so it can follow the text as the user types.
  const [month, setMonth] = React.useState<Date>(
    isoToDate(value) ?? new Date(2000, 0),
  );
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Keep the visible text in sync when the value changes from outside.
  React.useEffect(() => {
    setText(isoToDisplay(value));
    const d = isoToDate(value);
    if (d) setMonth(d);
  }, [value]);

  const selectedDate = isoToDate(value);
  const minDate = isoToDate(min);
  const maxDate = isoToDate(max);
  const disabledMatcher = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  const commitText = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onChange("");
      return;
    }
    const iso = displayToIso(trimmed);
    if (iso) {
      onChange(iso);
    } else {
      // Revert to the last valid value on invalid input.
      setText(isoToDisplay(value));
    }
  };

  const handleTextChange = (raw: string) => {
    setText(raw);
    // Open the calendar and move it to follow the digits being typed.
    if (!open && raw.trim() !== "") setOpen(true);
    const followMonth = partialToMonth(raw);
    if (followMonth) setMonth(followMonth);
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        ref={inputRef}
        id={id}
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        inputMode="numeric"
        onChange={(e) => handleTextChange(e.target.value)}
        onFocus={() => {
          if (!disabled) setOpen(true);
        }}
        onBlur={(e) => commitText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitText(text);
            setOpen(false);
          }
          if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="pr-10"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground"
            aria-label="Buka kalender"
          >
            <CalendarIcon className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="end"
          // Keep typing focus in the input while the calendar follows along.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            const target = e.target as Node;
            // Don't close when interacting with our own text input, or when the
            // nested month/year dropdown (rendered in a portal) is clicked.
            if (
              inputRef.current?.contains(target) ||
              (target instanceof Element &&
                target.closest("[data-calendar-dropdown]"))
            ) {
              e.preventDefault();
            }
          }}
        >
          <Calendar
            mode="single"
            captionLayout="dropdown"
            locale={idLocale}
            startMonth={new Date(fromYear, 0)}
            endMonth={new Date(toYear, 11)}
            month={month}
            onMonthChange={setMonth}
            selected={selectedDate}
            disabled={disabledMatcher.length > 0 ? disabledMatcher : undefined}
            components={{ Dropdown: CalendarDropdown }}
            onSelect={(date) => {
              if (date) {
                onChange(dateToIso(date));
                setText(isoToDisplay(dateToIso(date)));
                setMonth(date);
              }
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DateField;
