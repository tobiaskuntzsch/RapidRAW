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
      <div className="flex-1 bg-bg-primary flex items-center justify-center text-text-secondary">
        <p>Select an image from the library to begin editing.</p>
      </div>
    );
  }

  const lowResSrc = quickPreviewUrl || finalPreviewUrl || selectedImage.originalUrl;
  const highResSrc = finalPreviewUrl;

  const hasHighRes = !!highResSrc;
  const showHighRes = hasHighRes && highResLoaded;

  const baseImageClasses = "absolute top-0 left-0 w-full h-full max-w-full max-h-full object-contain";
  const highResImageClasses = `${baseImageClasses} transition-opacity duration-300`;

  return (
    <div className="flex-1 bg-bg-primary flex flex-col relative">
      <div className="absolute top-3 right-3 z-30">
        <button
          onClick={() => setShowOriginal(!showOriginal)}
          className="bg-surface text-text-primary p-2 rounded-md hover:bg-card-active transition-colors duration-200"
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
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <>
                <img
                  src={lowResSrc}
                  alt="Preview"
                  className={baseImageClasses}
                />
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
    </div>
  );
}