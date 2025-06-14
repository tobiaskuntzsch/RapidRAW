import { useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function Editor({
  selectedImage,
  quickPreviewUrl,
  finalPreviewUrl,
  showOriginal,
  setShowOriginal,
  isAdjusting,
  onBackToLibrary
}) {
  const [highResLoaded, setHighResLoaded] = useState(false);
  const [dimensions, setDimensions] = useState(null);

  // FIX: This effect now ONLY handles changes related to adjustments.
  useEffect(() => {
    if (isAdjusting) {
      setHighResLoaded(false);
    }
  }, [isAdjusting]);

  // FIX: This new effect ONLY handles resetting state when the image changes.
  useEffect(() => {
    setHighResLoaded(false);
    setDimensions(null);
  }, [selectedImage?.path]);


  if (!selectedImage) {
    return (
      <div className="flex-1 bg-bg-secondary rounded-lg flex items-center justify-center text-text-secondary">
        <p>Select an image from the library to begin editing.</p>
      </div>
    );
  }

  const lowResSrc = quickPreviewUrl;
  const highResSrc = finalPreviewUrl;
  const hasHighRes = !!highResSrc;
  const showHighRes = hasHighRes && highResLoaded;
  const baseImageClasses = "absolute top-0 left-0 w-full h-full max-w-full max-h-full object-contain";
  const highResImageClasses = `${baseImageClasses} transition-opacity duration-300`;

  return (
    <div className="flex-1 bg-bg-secondary rounded-lg flex flex-col relative overflow-hidden p-2 gap-2">
      <div className="flex-shrink-0 flex justify-between items-center px-1">
        <button
          onClick={onBackToLibrary}
          className="bg-surface text-text-primary p-2 rounded-full hover:bg-card-active transition-colors duration-200"
          title="Back to Library"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="bg-surface text-text-secondary text-xs px-4 py-2 rounded-full select-none truncate">
          <span className="font-medium text-text-primary">{selectedImage.path.split(/[\\/]/).pop()}</span>
          {dimensions && ` - ${dimensions.width} × ${dimensions.height}`}
        </div>

        <button
          onClick={() => setShowOriginal(!showOriginal)}
          className="bg-surface text-text-primary p-2 rounded-full hover:bg-card-active transition-colors duration-200"
          title={showOriginal ? "Show Edited Image" : "Show Original Image"}
        >
          {showOriginal ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden rounded-lg">
        <TransformWrapper key={selectedImage.path}>
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%' }}
            contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img
                src={selectedImage.originalUrl}
                alt="Original"
                className={baseImageClasses}
                style={{ display: showOriginal ? 'block' : 'none' }}
                onLoad={(e) => setDimensions({ width: e.target.naturalWidth, height: e.target.naturalHeight })}
              />

              {!showOriginal && lowResSrc && (
                <img
                  src={lowResSrc}
                  alt="Preview"
                  className={baseImageClasses}
                />
              )}

              {!showOriginal && hasHighRes && (
                <img
                  src={highResSrc}
                  alt="Final Preview"
                  onLoad={() => setHighResLoaded(true)}
                  className={highResImageClasses}
                  style={{
                    opacity: showHighRes ? 1 : 0,
                  }}
                />
              )}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  );
}