import { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export default function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [show, setShow] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value) || null;

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setShow(true));
    } else {
      setShow(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-bg-primary border border-border-color rounded-md px-3 py-2 focus:ring-accent focus:border-accent focus:outline-none focus:ring-2 flex justify-between items-center text-left"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="text-text-primary">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          size={20}
          className={`text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className={`
          absolute right-0 mt-2 w-full origin-top-right z-20
          transform transition-all duration-200 ease-out
          ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}
          ${show ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
        `}
      >
        <div
          className="bg-surface rounded-lg shadow-xl p-2 max-h-60 overflow-y-auto"
          role="listbox"
          aria-orientation="vertical"
        >
          {options.map((option) => {
            const isSelected = value === option.value;
            return (
              <button
                key={option.value}
                onClick={() => handleSelect(option)}
                className={`
                  w-full text-left px-3 py-2 text-sm rounded-md flex items-center justify-between
                  transition-colors duration-150
                  ${isSelected ? 'bg-bg-primary text-white font-semibold' : 'text-text-primary hover:bg-bg-primary'}
                `}
                role="option"
                aria-selected={isSelected}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={16} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}