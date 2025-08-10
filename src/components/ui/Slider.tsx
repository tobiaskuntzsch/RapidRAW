import React, { useState, useEffect, useRef } from 'react';
import { GLOBAL_KEYS } from './AppProperties';

interface SliderProps {
  defaultValue?: number;
  label: any;
  max: number;
  min: number;
  onChange(event: any): void;
  onDragStateChange?(state: boolean): void;
  step: number;
  value: number;
}

/**
 * A reusable slider component with a clickable reset icon and an interactive handle.
 * The slider's thumb animates with an "ease-in-out" effect when the value is set programmatically.
 * The numeric value can be clicked to manually input a precise value.
 * Double-clicking the label, value, or slider track will also reset the value.
 *
 * @param {Element|string} label - The text label for the slider.
 * @param {number} value - The current value of the slider.
 * @param {function} onChange - The callback function to execute on value change.
 * @param {number} min - The minimum value of the slider.
 * @param {number} max - The maximum value of the slider.
 * @param {number} step - The increment step of the slider.
 * @param {number} [defaultValue=0] - The value to reset to on icon click or double-click. Defaults to 0.
 * @param {function} [onDragStateChange] - Optional callback to report dragging state to a parent.
 */
const Slider = ({
  defaultValue = 0,
  label,
  max,
  min,
  onChange,
  onDragStateChange = () => {},
  step,
  value,
}: SliderProps) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const [isDragging, setIsDragging] = useState(false);
  const animationFrameRef = useRef<any>(undefined);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState<number>(value);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isLabelHovered, setIsLabelHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onDragStateChange(isDragging);
  }, [isDragging, onDragStateChange]);

  useEffect(() => {
    const handleDragEndGlobal = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mouseup', handleDragEndGlobal);
      window.addEventListener('touchend', handleDragEndGlobal);
    }

    return () => {
      window.removeEventListener('mouseup', handleDragEndGlobal);
      window.removeEventListener('touchend', handleDragEndGlobal);
    };
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const startValue = displayValue;
    const endValue = value;
    const duration = 300;
    let startTime: any = null;

    const easeInOut = (t: number) => t * t * (3 - 2 * t);

    const animate = (timestamp: any) => {
      if (!startTime) {
        startTime = timestamp;
      }

      const progress = timestamp - startTime;
      const linearFraction = Math.min(progress / duration, 1);
      const easedFraction = easeInOut(linearFraction);
      const currentValue = startValue + (endValue - startValue) * easedFraction;
      setDisplayValue(currentValue);

      if (linearFraction < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, isDragging]);

  useEffect(() => {
    if (!isEditing) {
      setInputValue(value);
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleReset = () => {
    const syntheticEvent = {
      target: {
        value: defaultValue,
      },
    };
    onChange(syntheticEvent);
  };

  const handleChange = (e: any) => {
    setDisplayValue(Number(e.target.value));
    onChange(e);
  };

  const handleDragStart = () => setIsDragging(true);
  const handleDragEnd = () => setIsDragging(false);

  const handleValueClick = () => {
    setIsEditing(true);
  };

  const handleInputChange = (e: any) => {
    setInputValue(Number(e.target.value));
  };

  const handleInputCommit = () => {
    let newValue = inputValue;

    if (isNaN(newValue)) {
      newValue = value;
    } else {
      newValue = Math.max(min, Math.min(max, newValue));
    }

    const syntheticEvent = {
      target: {
        value: newValue,
      },
    };
    onChange(syntheticEvent);
    setIsEditing(false);
  };

  const handleInputKeyDown = (e: any) => {
    if (e.key === 'Enter') {
      handleInputCommit();
      e.target.blur();
    } else if (e.key === 'Escape') {
      setInputValue(value);
      setIsEditing(false);
      e.target.blur();
    }
  };

  const handleRangeKeyDown = (e: any) => {
    if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())) {
      e.target.blur();
      return;
    }

    if (GLOBAL_KEYS.includes(e.key)) {
      e.target.blur();
    }
  };

  const stepStr = String(step);
  const decimalPlaces = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
  const numericValue = isNaN(Number(value)) ? 0 : Number(value);

  return (
    <div className="mb-2 group" ref={containerRef}>
      <div className="flex justify-between items-center mb-1">
        <div
          className={`grid ${typeof label === 'string' ? 'cursor-pointer' : ''}`}
          onClick={typeof label === 'string' ? handleReset : undefined}
          onDoubleClick={typeof label === 'string' ? handleReset : undefined}
          onMouseEnter={typeof label === 'string' ? () => setIsLabelHovered(true) : undefined}
          onMouseLeave={typeof label === 'string' ? () => setIsLabelHovered(false) : undefined}
          title={
            typeof label === 'string' && label
              ? `Click or double-click to reset ${label.toLowerCase()} to ${defaultValue}`
              : ''
          }
        >
          <span
            aria-hidden={isLabelHovered && typeof label === 'string'}
            className={`col-start-1 row-start-1 text-sm font-medium text-text-secondary select-none transition-opacity duration-200 ease-in-out ${
              isLabelHovered && typeof label === 'string' ? 'opacity-0' : 'opacity-100'
            }`}
          >
            {label}
          </span>

          {typeof label === 'string' && (
            <span
              aria-hidden={!isLabelHovered}
              className={`col-start-1 row-start-1 text-sm font-medium text-text-primary select-none transition-opacity duration-200 ease-in-out pointer-events-none ${
                isLabelHovered ? 'opacity-100' : 'opacity-0'
              }`}
            >
              Reset
            </span>
          )}
        </div>
        <div className="w-12 text-right">
          {isEditing ? (
            <input
              className="w-full text-sm text-right bg-card-active border border-gray-500 rounded px-1 py-0 outline-none focus:ring-1 focus:ring-blue-500 text-text-primary"
              max={max}
              min={min}
              onBlur={handleInputCommit}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              ref={inputRef}
              step={step}
              type="number"
              value={inputValue}
            />
          ) : (
            <span
              className="text-sm text-text-primary w-full text-right select-none cursor-text"
              onClick={handleValueClick}
              onDoubleClick={handleReset}
              title={`Click to edit, double-click to reset to ${defaultValue}`}
            >
              {label === 'Exposure' && numericValue === 0 ? '0' : numericValue.toFixed(decimalPlaces)}
            </span>
          )}
        </div>
      </div>
      <input
        className={`w-full h-1.5 bg-card-active rounded-full appearance-none cursor-pointer slider-input ${
          isDragging ? 'slider-thumb-active' : ''
        }`}
        max={String(max)}
        min={String(min)}
        onChange={handleChange}
        onDoubleClick={handleReset}
        onKeyDown={handleRangeKeyDown}
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
        onTouchEnd={handleDragEnd}
        onTouchStart={handleDragStart}
        step={String(step)}
        type="range"
        value={displayValue}
      />
    </div>
  );
};

export default Slider;
