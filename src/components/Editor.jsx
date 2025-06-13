import { useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Eye, EyeOff } from 'lucide-react';

export default function Editor({ 
  selectedImage, 
  quickPreviewUrl, 
  finalPreviewUrl, 
  showOriginal, 
  setShowOriginal, 
  isAdjusting 
}) {
  const [highResLoaded, setHighResLoaded] = useState(false);

  useEffect(() => {
    if (isAdjusting) {
      setHighResLoaded(false);
    }
  }, [isAdjusting]);

  if (!selectedImage) {
    return (
      <div className="panel-center items-center justify-center text-text-secondary">
        <p>Select an image from the library to begin editing.</p>
      </div>
    );
  }

  const lowResSrc = quickPreviewUrl || finalPreviewUrl || selectedImage.originalUrl;
  const highResSrc = finalPreviewUrl;

  const hasHighRes = !!highResSrc;
  const showHighRes = hasHighRes && highResLoaded;

  // Base classes without any transition properties
  const baseImageClasses = "absolute top-0 left-0 w-full h-full max-w-full max-h-full object-contain shadow-2xl";
  // Classes for the high-res image, which include the transition
  const highResImageClasses = `${baseImageClasses} transition-opacity duration-300`;

  return (
    <div className="panel-center relative">
      <div className="absolute top-3 right-3 z-30">
        <button
          onClick={() => setShowOriginal(!showOriginal)}
          className="btn-icon"
          title={showOriginal ? "Show Edited Image" : "Show Original Image"}
        >
          {showOriginal ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      <TransformWrapper key={selectedImage.path}>
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {showOriginal ? (
              <img
                src={selectedImage.originalUrl}
                alt="Original"
                className="max-w-full max-h-full object-contain shadow-2xl"
              />
            ) : (
              <>
                {/* Low-res image is always opaque and has no transition */}
                <img
                  src={lowResSrc}
                  alt="Preview"
                  className={baseImageClasses}
                />
                {/* High-res image fades in on top of the low-res one */}
                {hasHighRes && (
                  <img
                    src={highResSrc}
                    alt="Final Preview"
                    onLoad={() => setHighResLoaded(true)}
                    className={highResImageClasses}
                    style={{ opacity: showHighRes ? 1 : 0 }}
                  />
                )}
              </>
            )}
          </div>
        </TransformComponent>
      </TransformWrapper>
      {isAdjusting && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white bg-black/50 px-3 py-1 rounded-full text-sm animate-pulse">
          Processing...
        </div>
      )}
    </div>
  );
}