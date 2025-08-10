import React from 'react';
import clsx from 'clsx';

interface SwitchProps {
  checked: boolean;
  className?: string;
  disabled?: boolean;
  id?: string;
  label: string;
  onChange(val: boolean): any;
  tooltip?: string;
}

/**
 * A beautiful, reusable, and accessible toggle switch component.
 *
 * @param {string} label - The text label for the switch.
 * @param {boolean} checked - The current state of the switch.
 * @param {function(boolean): void} onChange - Callback function that receives the new boolean state.
 * @param {boolean} [disabled=false] - Whether the switch is interactive.
 * @param {string} [className=''] - Additional classes for the container.
 */
const Switch = ({ checked, className = '', disabled = false, label, onChange, tooltip }: SwitchProps) => {
  const uniqueId = `switch-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <label
      className={clsx(
        'flex items-center justify-between cursor-pointer',
        { 'cursor-not-allowed opacity-50': disabled },
        className,
      )}
      htmlFor={uniqueId}
    >
      <span className="text-sm text-text-secondary select-none">{label}</span>
      <div className="relative">
        <input
          checked={checked}
          className="peer sr-only"
          disabled={disabled}
          id={uniqueId}
          onChange={(e: any) => !disabled && onChange(e.target.checked)}
          type="checkbox"
        />
        <div className="w-10 h-5 bg-bg-primary rounded-full shadow-inner"></div>
        <div
          className={clsx(
            'absolute left-0.5 top-0.5 bg-text-secondary w-4 h-4 rounded-full transition-colors',
            'peer-checked:translate-x-5 peer-checked:bg-accent',
          )}
        ></div>
      </div>
    </label>
  );
};

export default Switch;
