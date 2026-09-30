import { Search } from "lucide-react";

const fieldClass =
  "h-11 w-full min-w-0 rounded-xl border border-outline-variant bg-card px-3 text-base text-on-surface shadow-card transition-colors outline-none placeholder:text-outline focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary md:text-sm";

export function ListSearchForm({
  action,
  q,
  from,
  to,
  showDates = false,
  placeholder,
  hidden,
}: {
  action: string;
  q?: string;
  from?: string;
  to?: string;
  showDates?: boolean;
  placeholder: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} className="mb-4 flex flex-col gap-2">
      {hidden
        ? Object.entries(hidden).map(([name, value]) =>
            value ? (
              <input key={name} type="hidden" name={name} value={value} />
            ) : null,
          )
        : null}
      <div className="relative">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-on-surface-variant"
          aria-hidden
        />
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          className={`${fieldClass} pl-10`}
        />
      </div>
      {showDates ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-body-sm text-on-surface-variant">
            From
            <input type="date" name="from" defaultValue={from} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-body-sm text-on-surface-variant">
            To
            <input type="date" name="to" defaultValue={to} className={fieldClass} />
          </label>
        </div>
      ) : null}
      <button type="submit" className="sr-only">
        Search
      </button>
    </form>
  );
}
