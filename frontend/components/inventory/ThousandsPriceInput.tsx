'use client';

interface ThousandsPriceInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function priceToThousandsInput(value: unknown) {
  if (value === null || value === undefined || value === '') return '';

  const number = Number(value);
  if (!Number.isFinite(number)) return '';

  const thousands = number / 1000;
  return Number.isInteger(thousands) ? String(thousands) : String(thousands).replace(/\.?0+$/, '');
}

export function normalizeThousandsInput(value: string) {
  return value.replace(/[^\d]/g, '');
}

export function fullPriceFromThousandsInput(value: string) {
  const number = Number(normalizeThousandsInput(value));
  return Number.isFinite(number) ? number * 1000 : 0;
}

export function ThousandsPriceInput({
  id,
  value,
  onChange,
  placeholder = '250',
  required = false,
}: ThousandsPriceInputProps) {
  return (
    <div className="relative mt-1">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        required={required}
        onChange={(event) => onChange(normalizeThousandsInput(event.target.value))}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-14 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
        placeholder={placeholder}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-gray-400 dark:text-gray-500">
        000
      </span>
    </div>
  );
}
