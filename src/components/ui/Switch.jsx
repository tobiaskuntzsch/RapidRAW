import clsx from 'clsx';

/**
 * A beautiful, reusable, and accessible toggle switch component.
 *
 * @param {string} label - The text label for the switch.
 * @param {boolean} checked - The current state of the switch.
 * @param {function(boolean): void} onChange - Callback function that receives the new boolean state.
 * @param {boolean} [disabled=false] - Whether the switch is interactive.
 * @param {string} [className=''] - Additional classes for the container.
 */
const Switch = ({ label, checked, onChange, disabled = false, className = '' }) => {
  const uniqueId = `switch-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <label
      htmlFor={uniqueId}
      className={clsx(
        'flex items-center justify-between cursor-pointer',
        { 'cursor-not-allowed opacity-50': disabled },
        className
      )}
    >
      <span className="text-sm text-text-secondary select-none">{label}</span>
      <div className="relative">
        <input
          id={uniqueId}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        <div
          className="w-10 h-5 bg-surface rounded-full shadow-inner"
        ></div>
        <div
          className={clsx(
            'absolute left-0.5 top-0.5 bg-text-secondary w-4 h-4 rounded-full transition-colors',
            'peer-checked:translate-x-5 peer-checked:bg-white'
          )}
        ></div>
      </div>
    </label>
  );
};

export default Switch;