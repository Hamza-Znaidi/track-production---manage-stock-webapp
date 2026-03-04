'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export default function AppDropdown({
  name,
  value,
  onValueChange,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  containerClassName,
  className,
  menuClassName,
  optionClassName,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const safeValue = value == null ? '' : String(value);

  const normalizedOptions = useMemo(
    () => (options || []).map((option) => ({
      ...option,
      value: String(option.value),
    })),
    [options]
  );

  const selectedOption = normalizedOptions.find((option) => option.value === safeValue);

  const emitChange = (nextValue) => {
    onValueChange?.(nextValue);
    onChange?.({ target: { name, value: nextValue } });
  };

  const handleSelection = (nextValue) => {
    if (disabled) return;
    emitChange(nextValue);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={cn('relative', containerClassName)}>
      {name ? <input type="hidden" name={name} value={safeValue} /> : null}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm transition-all duration-200 flex items-center justify-between disabled:cursor-not-allowed disabled:opacity-60',
          className
        )}
      >
        <span className={cn('truncate text-left', selectedOption ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 italic')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        className={cn(
          'absolute z-30 mt-2 w-full origin-top rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 p-1 shadow-lg transition-all duration-200 max-h-64 overflow-y-auto',
          isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none',
          menuClassName
        )}
      >
        {normalizedOptions.map((option) => {
          const isSelected = option.value === safeValue;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelection(option.value)}
              disabled={option.disabled}
              className={cn(
                'w-full rounded-md px-3 py-2 text-left text-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
                isSelected
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                  : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600',
                optionClassName
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
