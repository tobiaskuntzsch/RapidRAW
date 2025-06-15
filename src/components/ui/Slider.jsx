// src/components/ui/Slider.jsx

import React, { useState, useEffect, useRef } from 'react';

/**
 * A reusable slider component with a double-click-to-reset feature and an interactive handle.
 * The slider's thumb animates with an "ease-in-out" effect when the value is set programmatically.
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
  const [displayValue, setDisplayValue] = useState(Number(value));
  const [isDragging, setIsDragging] = useState(false);
  const animationFrameRef = useRef();

  useEffect(() => {
    if (isDragging) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const startValue = displayValue;
    const endValue = Number(value);
    const duration = 300; // 0.3s animation
    let startTime = null;

    /**
     * An ease-in-out function that starts slow, speeds up, and ends slow.
     * @param {number} t - A value from 0 to 1 representing animation progress.
     * @returns {number} The eased value, also from 0 to 1.
     */
    const easeInOut = (t) => t * t * (3 - 2 * t);

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const linearFraction = Math.min(progress / duration, 1);

      // Apply the easing function to the linear progress
      const easedFraction = easeInOut(linearFraction);

      // Use the eased fraction for interpolation
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

  const handleReset = () => {
    const syntheticEvent = {
      target: {
        value: defaultValue,
      },
    };
    onChange(syntheticEvent);
  };

  const handleChange = (e) => {
    setDisplayValue(Number(e.target.value));
    onChange(e);
  };

  const stepStr = String(step);
  const decimalPlaces = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
  
  const numericValue = isNaN(Number(value)) ? 0 : Number(value);

  const handleDragStart = () => setIsDragging(true);
  const handleDragEnd = () => setIsDragging(false);

  return (
    <div className="mb-2">
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
        value={displayValue}
        onChange={handleChange}
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
        className={`w-full h-1.5 bg-card-active rounded-full appearance-none cursor-pointer slider-input ${isDragging ? 'slider-thumb-active' : ''}`}
      />
    </div>
  );
};

export default Slider;