import { useState, useEffect, useRef, useMemo } from 'react';
import { Star, Copy, ClipboardPaste, RotateCcw, ChevronUp, ChevronDown, Check, Save, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import Filmstrip from './Filmstrip';

const StarRating = ({ rating, onRate, disabled }) => {
  return (
    <div className={clsx("flex items-center gap-1", disabled && "cursor-not-allowed")}>
      {[...Array(5)].map((_, index) => {
        const starValue = index + 1;
        return (
          <button
            key={starValue}
            onClick={() => !disabled && onRate(starValue === rating ? 0 : starValue)}
            title={disabled ? "Select an image to rate" : `Rate ${starValue} star${starValue > 1 ? 's' : ''}`}
            disabled={disabled}
            className="disabled:cursor-not-allowed"
          >
            <Star
              size={18}
              className={clsx(
                'transition-colors duration-150',
                disabled
                  ? 'text-bg-primary'
                  : starValue <= rating
                  ? 'fill-accent text-accent'
                  : 'text-text-secondary hover:text-accent'
              )}
            />
          </button>
        );
      })}
    </div>
  );
};

export default function BottomBar({
  rating,
  onRate,
  isRatingDisabled,
  onCopy,
  onPaste,
  isCopied,
  isPasted,
  isPasteDisabled,
  isCopyDisabled,
  zoom,
  onZoomChange,
  displaySize,
  originalSize,
  baseRenderSize,
  imageList,
  selectedImage,
  onImageSelect,
  onContextMenu,
  multiSelectedPaths,
  thumbnails,
  imageRatings,
  isFilmstripVisible,
  setIsFilmstripVisible,
  isLoading,
  onReset,
  isResetDisabled,
  onExportClick,
  isExportDisabled,
  isLibraryView = false,
  onClearSelection,
  filmstripHeight,
  isResizing,
}) {
  const [sliderValue, setSliderValue] = useState(zoom);
  const [isZoomLabelHovered, setIsZoomLabelHovered] = useState(false);
  const [isEditingPercent, setIsEditingPercent] = useState(false);
  const [percentInputValue, setPercentInputValue] = useState('');
  const isDraggingSlider = useRef(false);
  const syncTimeoutRef = useRef(null);
  const percentInputRef = useRef(null);

  // Zoom calculation and ready check
  const isZoomReady = originalSize && originalSize.width > 0 && displaySize && displaySize.width > 0;
  const currentOriginalPercent = isZoomReady ? (displaySize.width / originalSize.width) : 1.0;
  const displayPercent = isZoomReady ? Math.round(currentOriginalPercent * 100) : 100;

  useEffect(() => {
    if (!isDraggingSlider.current) {
      setSliderValue(currentOriginalPercent);
    }
  }, [currentOriginalPercent]);

  // Reset dragging state after a short delay if no mouse events (no jumping ball ;-) )
  useEffect(() => {
    const resetDragging = setTimeout(() => {
      if (isDraggingSlider.current) {
        isDraggingSlider.current = false;
      }
    }, 1000);

    return () => clearTimeout(resetDragging);
  }, [currentOriginalPercent]);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  const handleSliderChange = (e) => {
    const newZoom = parseFloat(e.target.value);
    setSliderValue(newZoom);
    onZoomChange(newZoom);
  };

  const handleMouseDown = () => {
    isDraggingSlider.current = true;
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
  };

  const handleMouseUp = () => {
    isDraggingSlider.current = false;
  };

  const handleZoomKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())) {
      e.target.blur();
      return;
    }
    const globalKeys = [' ', 'ArrowUp', 'ArrowDown', 'f', 'b', 'w'];
    if (globalKeys.includes(e.key)) {
      e.target.blur();
    }
  };

  const handleResetZoom = () => {
    onZoomChange('fit-to-window');
  };

  const handlePercentClick = () => {
    if (!isZoomReady) return;
    setIsEditingPercent(true);
    setPercentInputValue(displayPercent.toString());
    setTimeout(() => {
      if (percentInputRef.current) {
        percentInputRef.current.focus();
        percentInputRef.current.select();
      }
    }, 0);
  };

  const handlePercentSubmit = () => {
    const value = parseFloat(percentInputValue);
    if (!isNaN(value)) {
      const originalPercent = value / 100;
      const clampedPercent = Math.max(0.1, Math.min(2.0, originalPercent));
      onZoomChange(clampedPercent);
    }
    setIsEditingPercent(false);
    setPercentInputValue('');
  };

  const handlePercentKeyDown = (e) => {
    if (e.key === 'Enter') {
      handlePercentSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingPercent(false);
      setPercentInputValue('');
    }
    e.stopPropagation();
  };

  const handlePercentBlur = () => {
    handlePercentSubmit();
  };

  

  return (
    <div className="flex-shrink-0 bg-bg-secondary rounded-lg flex flex-col">
      {!isLibraryView && (
        <div
          className={clsx(
            "overflow-hidden",
            !isResizing && 'transition-all duration-300 ease-in-out',
            isFilmstripVisible ? 'p-2' : 'p-0'
          )}
          style={{ height: isFilmstripVisible ? `${filmstripHeight}px` : '0px' }}
        >
          <Filmstrip
            imageList={imageList}
            selectedImage={selectedImage}
            onImageSelect={onImageSelect}
            onContextMenu={onContextMenu}
            multiSelectedPaths={multiSelectedPaths}
            thumbnails={thumbnails}
            imageRatings={imageRatings}
            isLoading={isLoading}
            onClearSelection={onClearSelection}
          />
        </div>
      )}

      <div className={clsx(
        "flex-shrink-0 h-10 flex items-center justify-between px-3",
        !isLibraryView && isFilmstripVisible && "border-t border-surface"
      )}>
        <div className="flex items-center gap-4">
          <StarRating rating={rating} onRate={onRate} disabled={isRatingDisabled} />
          <div className="h-5 w-px bg-surface"></div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCopy}
              title="Copy Settings"
              disabled={isCopyDisabled}
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors disabled:text-bg-primary disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              {isCopied ? (
                <Check size={18} className="text-green-500 animate-pop-in" />
              ) : (
                <Copy size={18} />
              )}
            </button>

            <button
              onClick={onPaste}
              title="Paste Settings"
              disabled={isPasteDisabled}
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors disabled:text-bg-primary disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              {isPasted ? (
                <Check size={18} className="text-green-500 animate-pop-in" />
              ) : (
                <ClipboardPaste size={18} />
              )}
            </button>
          </div>
        </div>
        
        {isLibraryView ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onReset}
              title="Reset All Adjustments"
              disabled={isResetDisabled}
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors disabled:text-bg-primary disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={onExportClick}
              title="Export Selected Images"
              disabled={isExportDisabled}
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors disabled:text-bg-primary disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              <Save size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 w-56">
              <div
                className="relative w-12 h-full flex items-center justify-end cursor-pointer"
                onMouseEnter={() => setIsZoomLabelHovered(true)}
                onMouseLeave={() => setIsZoomLabelHovered(false)}
                onClick={handleResetZoom}
                title="Reset Zoom to Fit Window"
              >
                <span className="absolute right-0 text-xs text-text-secondary select-none text-right w-max transition-colors hover:text-text-primary">
                  {isZoomLabelHovered ? 'Reset Zoom' : 'Zoom'}
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={2.0}
                step="0.05"
                value={isZoomReady ? sliderValue : 0.1}
                onChange={handleSliderChange}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchEnd={handleMouseUp}
                onDoubleClick={handleResetZoom}
                onKeyDown={handleZoomKeyDown}
                className="flex-1 h-1 bg-surface rounded-lg appearance-none cursor-pointer accent-accent"
                disabled={!isZoomReady}
                style={{ opacity: isZoomReady ? 1 : 0.3 }}
              />
              <div className="relative text-xs text-text-secondary w-20 text-right flex items-center justify-end h-5 gap-1">
                {isZoomReady ? (
                  <>
                    {isEditingPercent ? (
                      <input
                        ref={percentInputRef}
                        type="text"
                        value={percentInputValue}
                        onChange={(e) => setPercentInputValue(e.target.value)}
                        onKeyDown={handlePercentKeyDown}
                        onBlur={handlePercentBlur}
                        className="w-full text-xs text-text-primary bg-bg-primary border border-border-color rounded px-1 text-right"
                        style={{ fontSize: '12px', height: '18px' }}
                      />
                    ) : (
                      <span 
                        onClick={handlePercentClick}
                        className="cursor-pointer hover:text-text-primary transition-colors select-none"
                        title="Click to enter custom zoom percentage"
                      >
                        {displayPercent}%
                      </span>
                    )}
                  </>
                ) : (
                  <Loader2 size={12} className="animate-spin" />
                )}
              </div>
            </div>
            <button
              onClick={() => setIsFilmstripVisible(!isFilmstripVisible)}
              className="p-1.5 rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
              title={isFilmstripVisible ? "Collapse Filmstrip" : "Expand Filmstrip"}
            >
              {isFilmstripVisible ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}