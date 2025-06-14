// src/components/ui/Slider.jsx

import React, { useState } from 'react';

/**
 * A reusable slider component with a double-click-to-reset feature and an interactive handle.
 *
 * @param {string} label - The text label for the slider.
 * @param {number|string} value - The current value of the slider.
 * @param {function} onChange - The callback function to execute on value change.
 * @param {number|string} min - The minimum value of the slider.
 * @param {number|string} max - The maximum value of the slider.
 * @param {number|string} step - The increment step of the slider.
 * @param {number} [defaultValue=0] - The value to reset to on double-click. Defaults to 0.
 */
const Slider = ({ label, value, onChange, min, max, step, defaultValue = 0 }) => {
  // State to track if the user is currently dragging the slider handle
  const [isDragging, setIsDragging] = useState(false);

  /**
   * Handles the reset action on double-click.
   * It calls the passed `onChange` function with a synthetic event object
   * that contains the `defaultValue`. This makes it compatible with any
   * existing change handler without modification.
   */
  const handleReset = () => {
    const syntheticEvent = {
      target: {
        value: defaultValue,
      },
    };
    onChange(syntheticEvent);
  };

  // Convert step to string to safely check for decimal places
  const stepStr = String(step);
  const decimalPlaces = stepStr.includes('.') ? 1 : 0;
  
  // Ensure value is a valid number, default to 0 if NaN
  const numericValue = isNaN(Number(value)) ? 0 : Number(value);

  // Handlers to set the dragging state for mouse and touch events
  const handleDragStart = () => setIsDragging(true);
  const handleDragEnd = () => setIsDragging(false);

  return (
    <div className="mb-2">
      {/* We attach the onDoubleClick handler to the container of the label and value */}
      <div 
        className="flex justify-between items-center mb-1 cursor-pointer" 
        onDoubleClick={handleReset}
      >
        <label className="text-sm font-medium text-text-secondary select-none">{label}</label>
        <span className="text-sm text-text-primary w-12 text-right select-none">
          {numericValue.toFixed(decimalPlaces)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numericValue}
        onChange={onChange}
        // Add event handlers for mouse and touch interaction
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
        // Conditionally apply a class when dragging
        className={`w-full h-1.5 bg-card-active rounded-full appearance-none cursor-pointer slider-input ${isDragging ? 'slider-thumb-active' : ''}`}
      />
    </div>
  );
};

export default Slider;