import { useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Eye, EyeOff, ArrowLeft, Maximize, X, Loader2 } from 'lucide-react';

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 100,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}


function FullScreenViewer({ url, isLoading, onClose }) {
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimatingIn(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsAnimatingIn(false);
    setTimeout(onClose, 300); 
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center transition-colors duration-300"
      style={{ 
        backgroundColor: isAnimatingIn ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0)' 
      }}
      onClick={handleClose}
    >
      <button 
        className="absolute top-4 right-4 text-white hover:text-gray-300 z-[102] transition-opacity duration-300"
        style={{ opacity: isAnimatingIn ? 1 : 0 }}
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        title="Close (Esc or F)"
      >
        <X size={32} />
      </button>

      <div
        className="w-full h-full flex items-center justify-center transition-all duration-300 ease-in-out"
        style={{
          transform: isAnimatingIn ? 'scale(1)' : 'scale(0.9)',
          opacity: isAnimatingIn ? 1 : 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && <Loader2 className="w-16 h-16 text-white animate-spin" />}
        
        {!isLoading && url && (
          <TransformWrapper
            key={url}
            initialScale={1}
            minScale={0.8}
            maxScale={10}
            limitToBounds={true}
            doubleClick={{ disabled: true }}
          >
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <img 
                src={url} 
                alt="Fullscreen Preview" 
                className="max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-md"
              />
            </TransformComponent>
          </TransformWrapper>
        )}
      </div>
    </div>
  );
}


export default function Editor({
  selectedImage,
  quickPreviewUrl,
  finalPreviewUrl,
  showOriginal,
  setShowOriginal,
  isAdjusting,
  onBackToLibrary,
  isLoading,
  isFullScreen,
  isFullScreenLoading,
  fullScreenUrl,
  onToggleFullScreen,
  activeRightPanel,
  adjustments,
  setAdjustments,
  thumbnails,
}) {
  const [highResLoaded, setHighResLoaded] = useState(false);
  const [quickPreviewLoaded, setQuickPreviewLoaded] = useState(false);
  const [isLoaderMounted, setIsLoaderMounted] = useState(false);
  const [isLoaderVisible, setIsLoaderVisible] = useState(false);
  const [crop, setCrop] = useState();
  
  const isCropping = activeRightPanel === 'crop';
  const thumbnailData = thumbnails[selectedImage?.path];
  const showSpinner = isLoading && !quickPreviewUrl && !thumbnailData;

  useEffect(() => {
    let timeoutId;
    if (showSpinner) {
      setIsLoaderMounted(true);
      timeoutId = setTimeout(() => setIsLoaderVisible(true), 50);
    } else {
      setIsLoaderVisible(false);
      timeoutId = setTimeout(() => setIsLoaderMounted(false), 300);
    }
    return () => clearTimeout(timeoutId);
  }, [showSpinner]);
  
  useEffect(() => {
    if (isAdjusting) {
      setHighResLoaded(false);
      setQuickPreviewLoaded(false);
    }
  }, [isAdjusting]);

  useEffect(() => {
    setHighResLoaded(false);
    setQuickPreviewLoaded(false);
    setCrop(undefined);
  }, [selectedImage?.path]);

  useEffect(() => {
    if (!isCropping) {
      setCrop(undefined);
      return;
    }

    const { width: originalWidth, height: originalHeight } = selectedImage;
    if (!originalWidth || !originalHeight) return;

    if (adjustments.crop) {
      const { x, y, width, height } = adjustments.crop;
      setCrop({
        unit: '%',
        x: (x / originalWidth) * 100,
        y: (y / originalHeight) * 100,
        width: (width / originalWidth) * 100,
        height: (height / originalHeight) * 100,
      });
    } 
    else {
      const { aspectRatio } = adjustments;
      let newCrop;
      if (aspectRatio) {
        newCrop = centerAspectCrop(originalWidth, originalHeight, aspectRatio);
      } else {
        newCrop = { unit: '%', width: 100, height: 100, x: 0, y: 0 };
      }
      setCrop(newCrop);
    }
  }, [isCropping, adjustments.crop, adjustments.aspectRatio, selectedImage]);

  const handleCropComplete = (c, pc) => {
    if (pc.width && pc.height && selectedImage?.width && selectedImage?.height) {
      const { width: originalWidth, height: originalHeight } = selectedImage;
      
      const pixelCrop = {
        x: Math.round((pc.x / 100) * originalWidth),
        y: Math.round((pc.y / 100) * originalHeight),
        width: Math.round((pc.width / 100) * originalWidth),
        height: Math.round((pc.height / 100) * originalHeight),
      };
      
      const isFullImageCrop = pixelCrop.x === 0 && pixelCrop.y === 0 && pixelCrop.width === originalWidth && pixelCrop.height === originalHeight;

      if (isFullImageCrop && !adjustments.aspectRatio) {
        if (adjustments.crop !== null) {
          setAdjustments(prev => ({ ...prev, crop: null }));
        }
      } else if (JSON.stringify(pixelCrop) !== JSON.stringify(adjustments.crop)) {
        setAdjustments(prev => ({ ...prev, crop: pixelCrop }));
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 'f' && !isFullScreen) {
        if (document.activeElement.tagName.toLowerCase() === 'input') return;
        e.preventDefault();
        onToggleFullScreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen, onToggleFullScreen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '.') {
        if (document.activeElement.tagName.toLowerCase() === 'input') return;
        e.preventDefault();
        setShowOriginal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowOriginal]);

  if (!selectedImage) {
    return (
      <div className="flex-1 bg-bg-secondary rounded-lg flex items-center justify-center text-text-secondary">
        <p>Select an image from the library to begin editing.</p>
      </div>
    );
  }

  const baseImageClasses = "absolute top-0 left-0 w-full h-full max-w-full max-h-full object-contain";
  const highResImageClasses = `${baseImageClasses} transition-opacity duration-300`;

  return (
    <>
      {isFullScreen && (
        <FullScreenViewer 
          key={selectedImage.path}
          url={fullScreenUrl}
          isLoading={isFullScreenLoading}
          onClose={onToggleFullScreen}
        />
      )}
      <div className="flex-1 bg-bg-secondary rounded-lg flex flex-col relative overflow-hidden p-2 gap-2">
        <div className="flex-shrink-0 flex justify-between items-center px-1">
          <button onClick={onBackToLibrary} className="bg-surface text-text-primary p-2 rounded-full hover:bg-card-active transition-colors duration-200" title="Back to Library">
            <ArrowLeft size={20} />
          </button>
          <div className="bg-surface text-text-secondary text-xs px-4 py-2 rounded-full select-none truncate flex items-center">
            <span className="font-medium text-text-primary mr-2">{selectedImage.path.split(/[\\/]/).pop()}</span>
            {isLoading && <Loader2 size={12} className="animate-spin" />}
            {selectedImage.width > 0 && ` - ${selectedImage.width} × ${selectedImage.height}`}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowOriginal(!showOriginal)} className="bg-surface text-text-primary p-2 rounded-full hover:bg-card-active transition-colors duration-200" title={showOriginal ? "Show Edited Image (.)" : "Show Original Image (.)"}>
              {showOriginal ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            <button onClick={onToggleFullScreen} className="bg-surface text-text-primary p-2 rounded-full hover:bg-card-active transition-colors duration-200" title="Toggle Fullscreen (F)" disabled={isFullScreenLoading}>
              {isFullScreenLoading ? <Loader2 size={20} className="animate-spin" /> : <Maximize size={20} />}
            </button>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden rounded-lg">
          {isLoaderMounted && (
            <div className={`absolute inset-0 bg-bg-secondary/80 flex items-center justify-center z-50 transition-opacity duration-300 ease-in-out ${isLoaderVisible ? 'opacity-100' : 'opacity-0'}`}>
              <Loader2 size={48} className="animate-spin text-accent" />
            </div>
          )}

          {isCropping ? (
            <div className="w-full h-full flex items-center justify-center bg-bg-secondary p-8">
              {selectedImage.originalUrl && (
                <div style={{ width: '70%', height: '70%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={handleCropComplete}
                    aspect={adjustments.aspectRatio}
                  >
                    <img
                      alt="Crop preview"
                      src={selectedImage.originalUrl}
                      style={{
                        display: 'block',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </ReactCrop>
                </div>
              )}
            </div>
          ) : (
            <TransformWrapper key={selectedImage.path} minScale={0.7} limitToBounds={true} centerZoomedOut={false} doubleClick={{ disabled: true }}>
              <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="relative w-full h-full flex items-center justify-center p-4">
                  <img 
                    src={selectedImage.originalUrl} 
                    alt="Original" 
                    className={baseImageClasses} 
                    style={{ opacity: showOriginal ? 1 : 0, pointerEvents: 'none' }} 
                  />
                  
                  {!showOriginal && thumbnailData && (
                    <img
                      src={thumbnailData}
                      alt="Thumbnail"
                      className={baseImageClasses}
                      style={{
                        opacity: quickPreviewLoaded ? 0 : 1,
                        zIndex: 1,
                      }}
                    />
                  )}

                  {!showOriginal && quickPreviewUrl && (
                    <img
                      src={quickPreviewUrl}
                      alt="Preview"
                      onLoad={() => setQuickPreviewLoaded(true)}
                      className={baseImageClasses}
                      style={{ zIndex: 2 }}
                    />
                  )}

                  {!showOriginal && finalPreviewUrl && (
                    <img
                      src={finalPreviewUrl}
                      alt="Final Preview"
                      onLoad={() => setHighResLoaded(true)}
                      className={highResImageClasses}
                      style={{
                        opacity: highResLoaded ? 1 : 0,
                        zIndex: 3,
                      }}
                    />
                  )}

                </div>
              </TransformComponent>
            </TransformWrapper>
          )}
        </div>
      </div>
    </>
  );
}