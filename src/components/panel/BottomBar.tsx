import { useState, useEffect, useRef, useMemo } from 'react';
import { Star, Copy, ClipboardPaste, RotateCcw, ChevronUp, ChevronDown, Check, Save, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import Filmstrip from './Filmstrip';
import { GLOBAL_KEYS, ImageFile, SelectedImage, ThumbnailAspectRatio } from '../ui/AppProperties';

interface BottomBarProps {
  filmstripHeight?: number;
  imageList?: Array<ImageFile>;
  imageRatings?: Record<string, number> | null;
  isCopied: boolean;
  isCopyDisabled: boolean;
  isExportDisabled?: boolean;
  isFilmstripVisible?: boolean;
  isLibraryView?: boolean;
  isLoading?: boolean;
  isPasted: boolean;
  isPasteDisabled: boolean;
  isRatingDisabled?: boolean;
  isResetDisabled?: boolean;
  isResizing?: boolean;
  multiSelectedPaths?: Array<string>;
  onClearSelection?(): void;
  onContextMenu?(event: any, path: string): void;
  onCopy(): void;
  onExportClick?(): void;
  onImageSelect?(path: string, event: any): void;
  onPaste(): void;
  onRate(rate: number): void;
  onReset?(): void;
  onZoomChange?(zoom: number | string): void;
  rating: number;
  selectedImage?: SelectedImage;
  setIsFilmstripVisible?(isVisible: boolean): void;
  thumbnails?: Record<string, string>;
  thumbnailAspectRatio: ThumbnailAspectRatio;
  zoom?: number;
  displaySize?: { width: number; height: number };
  originalSize?: { width: number; height: number };
  baseRenderSize?: { width: number; height: number };
}

interface StarRatingProps {
  disabled: boolean;
  onRate(rate: number): void;
  rating: number;
}

const StarRating = ({ rating, onRate, disabled }: StarRatingProps) => {
  return (
    <div className={clsx('flex items-center gap-1', disabled && 'cursor-not-allowed')}>
      {[...Array(5)].map((_, index: number) => {
        const starValue = index + 1;
        return (
          <button
            className="disabled:cursor-not-allowed"
            disabled={disabled}
            key={starValue}
            onClick={() => !disabled && onRate(starValue === rating ? 0 : starValue)}
            title={disabled ? 'Select an image to rate' : `Rate ${starValue} star${starValue > 1 ? 's' : ''}`}
          >
            <Star
              size={18}
              className={clsx(
                'transition-colors duration-150',
                disabled
                  ? 'text-bg-primary'
                  : starValue <= rating
                  ? 'fill-accent text-accent'
                  : 'text-text-secondary hover:text-accent',
              )}
            />
          </button>
        );
      })}
    </div>
  );
};

export default function BottomBar({
  filmstripHeight,
  imageList = [],
  imageRatings,
  isCopied,
  isCopyDisabled,
  isExportDisabled,
  isFilmstripVisible,
  isLibraryView = false,
  isLoading = false,
  isPasted,
  isPasteDisabled,
  isRatingDisabled = false,
  isResetDisabled = false,
  isResizing,
  multiSelectedPaths = [],
  onClearSelection,
  onContextMenu,
  onCopy,
  onExportClick,
  onImageSelect,
  onPaste,
  onRate,
  onReset,
  onZoomChange = () => {},
  rating,
  selectedImage,
  setIsFilmstripVisible,
  thumbnails,
  thumbnailAspectRatio,
  zoom = 0,
  displaySize,
  originalSize,
  baseRenderSize,
}: BottomBarProps) {
  const [sliderValue, setSliderValue] = useState(zoom);
  const [isZoomLabelHovered, setIsZoomLabelHovered] = useState(false);
  const [isEditingPercent, setIsEditingPercent] = useState(false);
  const [percentInputValue, setPercentInputValue] = useState('');
  const isDraggingSlider = useRef(false);
  const syncTimeoutRef = useRef<any>(null);
  const percentInputRef = useRef<HTMLInputElement>(null);

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

  const handleSliderChange = (e: any) => {
    const newZoom = parseFloat(e.target.value);
    setSliderValue(newZoom);
    if (onZoomChange) {
      onZoomChange(newZoom);
    }
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

  const handleZoomKeyDown = (e: any) => {
    if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())) {
      e.target.blur();
      return;
    }

    if (GLOBAL_KEYS.includes(e.key)) {
      e.target.blur();
    }
  };

  const handleResetZoom = () => {
    if (onZoomChange) {
      onZoomChange('fit-to-window');
    }
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
    if (!isNaN(value) && onZoomChange) {
      const originalPercent = value / 100;
      const clampedPercent = Math.max(0.1, Math.min(2.0, originalPercent));
      onZoomChange(clampedPercent);
    }
    setIsEditingPercent(false);
    setPercentInputValue('');
  };

  const handlePercentKeyDown = (e: any) => {
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
            'overflow-hidden',
            !isResizing && 'transition-all duration-300 ease-in-out',
            isFilmstripVisible ? 'p-2' : 'p-0',
          )}
          style={{ height: isFilmstripVisible ? `${filmstripHeight}px` : '0px' }}
        >
          <Filmstrip
            imageList={imageList}
            imageRatings={imageRatings}
            isLoading={isLoading}
            multiSelectedPaths={multiSelectedPaths}
            onClearSelection={onClearSelection}
            onContextMenu={onContextMenu}
            onImageSelect={onImageSelect}
            selectedImage={selectedImage}
            thumbnails={thumbnails}
            thumbnailAspectRatio={thumbnailAspectRatio}
          />
        </div>
      )}

      <div
        className={clsx(
          'flex-shrink-0 h-10 flex items-center justify-between px-3',
          !isLibraryView && isFilmstripVisible && 'border-t border-surface',
        )}
      >
        <div className="flex items-center gap-4">
          <StarRating rating={rating} onRate={onRate} disabled={isRatingDisabled} />
          <div className="h-5 w-px bg-surface"></div>
          <div className="flex items-center gap-2">
            <button
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors disabled:text-bg-primary disabled:hover:bg-transparent disabled:cursor-not-allowed"
              disabled={isCopyDisabled}
              onClick={onCopy}
              title="Copy Settings"
            >
              {isCopied ? <Check size={18} className="text-green-500 animate-pop-in" /> : <Copy size={18} />}
            </button>

            <button
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors disabled:text-bg-primary disabled:hover:bg-transparent disabled:cursor-not-allowed"
              disabled={isPasteDisabled}
              onClick={onPaste}
              title="Paste Settings"
            >
              {isPasted ? <Check size={18} className="text-green-500 animate-pop-in" /> : <ClipboardPaste size={18} />}
            </button>
          </div>
        </div>

        {isLibraryView ? (
          <div className="flex items-center gap-2">
            <button
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors disabled:text-bg-primary disabled:hover:bg-transparent disabled:cursor-not-allowed"
              disabled={isResetDisabled}
              onClick={onReset}
              title="Reset All Adjustments"
            >
              <RotateCcw size={18} />
            </button>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors disabled:text-bg-primary disabled:hover:bg-transparent disabled:cursor-not-allowed"
              disabled={isExportDisabled}
              onClick={onExportClick}
              title="Export Selected Images"
            >
              <Save size={18} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 w-56">
              <div
                className="relative w-12 h-full flex items-center justify-end cursor-pointer"
                onClick={handleResetZoom}
                onMouseEnter={() => setIsZoomLabelHovered(true)}
                onMouseLeave={() => setIsZoomLabelHovered(false)}
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
                onKeyDown={handleZoomKeyDown}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchEnd={handleMouseUp}
                onDoubleClick={handleResetZoom}
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
              className="p-1.5 rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
              onClick={() => {
                if (setIsFilmstripVisible) {
                  setIsFilmstripVisible(!isFilmstripVisible);
                }
              }}
              title={isFilmstripVisible ? 'Collapse Filmstrip' : 'Expand Filmstrip'}
            >
              {isFilmstripVisible ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}