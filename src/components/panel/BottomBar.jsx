import { Star, Copy, ClipboardPaste, ChevronUp, ChevronDown } from 'lucide-react';
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
                  ? 'fill-yellow-400 text-yellow-400'
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
  thumbnails,
  isFilmstripVisible,
  setIsFilmstripVisible,
  isLoading,
}) {
  return (
    <div className="flex-shrink-0 bg-bg-secondary rounded-lg flex flex-col">
      {/* Filmstrip content area - animates height and padding */}
      <div className={clsx(
        "transition-all duration-300 ease-in-out overflow-hidden",
        isFilmstripVisible ? 'h-36 p-2' : 'h-0 p-0'
      )}>
        <Filmstrip
          imageList={imageList}
          selectedImage={selectedImage}
          onImageSelect={onImageSelect}
          thumbnails={thumbnails}
          isLoading={isLoading}
        />
      </div>

      {/* Control bar area */}
      <div className={clsx(
        "flex-shrink-0 h-10 flex items-center justify-between px-3",
        isFilmstripVisible && "border-t border-surface" // Separator line
      )}>
        <div className="flex items-center gap-4">
          <StarRating rating={rating} onRate={onRate} />
          <div className="h-5 w-px bg-surface"></div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCopy}
              title="Copy Settings"
              className="p-1 rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors"
            >
              <Copy size={18} />
            </button>
            <button
              onClick={onPaste}
              title="Paste Settings"
              disabled={isPasteDisabled}
              className="p-1 rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors disabled:text-bg-primary disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              <ClipboardPaste size={18} />
            </button>
          </div>
        </div>
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
      </div>
    </div>
  );
}