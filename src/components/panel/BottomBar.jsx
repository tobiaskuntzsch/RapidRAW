import { useState, useEffect } from 'react';
import { Star, Copy, ClipboardPaste, RotateCcw, ChevronUp, ChevronDown, Check, Save } from 'lucide-react';
import clsx from 'clsx';
import Filmstrip from './Filmstrip';

const StarRating = ({ rating, onRate }) => {
  return (
    <div className="flex items-center gap-1">
      {[...Array(5)].map((_, index) => {
        const starValue = index + 1;
        return (
          <button key={starValue} onClick={() => onRate(starValue === rating ? 0 : starValue)} title={`Rate ${starValue} star${starValue > 1 ? 's' : ''}`}>
            <Star
              size={18}
              className={`transition-colors duration-150 ${
                starValue <= rating
                  ? 'fill-white text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
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
  onCopy,
  onPaste,
  isPasteDisabled,
  zoom,
  onZoomChange,
  minZoom,
  maxZoom,
  imageList,
  selectedImage,
  onImageSelect,
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
  onClearSelection, // <-- ADDED PROP
}) {
  const [isCopied, setIsCopied] = useState(false);
  const [isPasted, setIsPasted] = useState(false);

  const handleCopyClick = () => {
    onCopy();
    setIsCopied(true);
  };

  const handlePasteClick = () => {
    onPaste();
    setIsPasted(true);
  };

  useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => setIsCopied(false), 1000);
    return () => clearTimeout(timer);
  }, [isCopied]);

  useEffect(() => {
    if (!isPasted) return;
    const timer = setTimeout(() => setIsPasted(false), 1000);
    return () => clearTimeout(timer);
  }, [isPasted]);

  return (
    <div className="flex-shrink-0 bg-bg-secondary rounded-lg flex flex-col">
      {!isLibraryView && (
        <div className={clsx(
          "transition-all duration-300 ease-in-out overflow-hidden",
          isFilmstripVisible ? 'h-36 p-2' : 'h-0 p-0'
        )}>
          <Filmstrip
            imageList={imageList}
            selectedImage={selectedImage}
            onImageSelect={onImageSelect}
            multiSelectedPaths={multiSelectedPaths}
            thumbnails={thumbnails}
            imageRatings={imageRatings}
            isLoading={isLoading}
            onClearSelection={onClearSelection} // <-- PASSED PROP DOWN
          />
        </div>
      )}

      <div className={clsx(
        "flex-shrink-0 h-10 flex items-center justify-between px-3",
        !isLibraryView && isFilmstripVisible && "border-t border-surface"
      )}>
        <div className="flex items-center gap-4">
          <StarRating rating={rating} onRate={onRate} />
          <div className="h-5 w-px bg-surface"></div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyClick}
              title="Copy Settings"
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
            >
              {isCopied ? (
                <Check size={18} className="text-green-500 animate-pop-in" />
              ) : (
                <Copy size={18} />
              )}
            </button>

            <button
              onClick={handlePasteClick}
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
            <div className="flex items-center gap-2 w-48">
              <span className="text-xs text-text-secondary">Zoom</span>
              <input
                type="range"
                min={minZoom}
                max={maxZoom}
                step="0.05"
                value={zoom}
                onChange={(e) => onZoomChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-surface rounded-lg appearance-none cursor-pointer accent-accent"
              />
              <span className="text-xs text-text-secondary w-10 text-right">{(zoom * 100).toFixed(0)}%</span>
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