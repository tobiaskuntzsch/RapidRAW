import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Eye, EyeOff, ArrowLeft, Maximize, X, Loader2 } from 'lucide-react';
import { Stage, Layer, Ellipse, Line, Transformer } from 'react-konva';
import clsx from 'clsx';

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 100 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

const useKeydown = (key, callback, enabled = true) => {
  const memoizedCallback = useCallback(callback, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e) => {
      if (e.key.toLowerCase() === key.toLowerCase()) {
        if (document.activeElement.tagName.toLowerCase() === 'input') return;
        e.preventDefault();
        memoizedCallback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, memoizedCallback, enabled]);
};

const useImageRenderSize = (containerRef, imageDimensions) => {
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0, scale: 1 });

  useEffect(() => {
    const container = containerRef.current;
    const { width: imgWidth, height: imgHeight } = imageDimensions || {};
    if (!container || !imgWidth || !imgHeight) return;

    const updateSize = () => {
      const { clientWidth: containerWidth, clientHeight: containerHeight } = container;
      const imageAspectRatio = imgWidth / imgHeight;
      const containerAspectRatio = containerWidth / containerHeight;

      let width, height;
      if (imageAspectRatio > containerAspectRatio) {
        width = containerWidth;
        height = containerWidth / imageAspectRatio;
      } else {
        height = containerHeight;
        width = containerHeight * imageAspectRatio;
      }
      setRenderSize({ width, height, scale: width / imgWidth });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [containerRef, imageDimensions]);

  return renderSize;
};

const FullScreenViewer = memo(({ url, isLoading, onClose }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = useCallback(() => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  useKeydown('Escape', handleClose);
  useKeydown('f', handleClose);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center transition-colors duration-300"
      style={{ backgroundColor: isAnimating ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0)' }}
      onClick={handleClose}
    >
      <button
        className="absolute top-4 right-4 text-white hover:text-gray-300 z-[102] transition-opacity duration-300"
        style={{ opacity: isAnimating ? 1 : 0 }}
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
        title="Close (Esc or F)"
      >
        <X size={32} />
      </button>

      <div
        className="w-full h-full flex items-center justify-center transition-all duration-300 ease-in-out"
        style={{
          transform: isAnimating ? 'scale(1)' : 'scale(0.9)',
          opacity: isAnimating ? 1 : 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading && <Loader2 className="w-16 h-16 text-white animate-spin" />}
        {!isLoading && url && (
          <TransformWrapper key={url} minScale={0.8} maxScale={10} limitToBounds={true} doubleClick={{ disabled: true }}>
            <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={url} alt="Fullscreen Preview" className="max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-md" />
            </TransformComponent>
          </TransformWrapper>
        )}
      </div>
    </div>
  );
});

const MaskOverlay = memo(({ mask, scale, onUpdate, isSelected, onSelect, onMaskMouseEnter, onMaskMouseLeave }) => {
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const handleTransformEnd = useCallback(() => {
    const node = shapeRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onUpdate(mask.id, {
      geometry: {
        ...mask.geometry,
        x: node.x() / scale,
        y: node.y() / scale,
        radiusX: (node.radiusX() * scaleX) / scale,
        radiusY: (node.radiusY() * scaleY) / scale,
      },
      rotation: node.rotation(),
    });
  }, [mask.id, mask.geometry, onUpdate, scale]);

  const handleDragEnd = useCallback((e) => {
    onUpdate(mask.id, {
      geometry: { ...mask.geometry, x: e.target.x() / scale, y: e.target.y() / scale },
    });
  }, [mask.id, mask.geometry, onUpdate, scale]);

  if (!mask.visible) {
    return null;
  }

  const commonProps = {
    onClick: onSelect,
    onTap: onSelect,
    onMouseEnter: onMaskMouseEnter,
    onMouseLeave: onMaskMouseLeave,
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
    draggable: true,
    stroke: isSelected ? '#0ea5e9' : 'white',
    strokeWidth: isSelected ? 2 : 1,
    strokeScaleEnabled: false,
    dash: [4, 4],
  };

  if (mask.type === 'radial') {
    return (
      <>
        <Ellipse
          ref={shapeRef}
          x={mask.geometry.x * scale}
          y={mask.geometry.y * scale}
          radiusX={mask.geometry.radiusX * scale}
          radiusY={mask.geometry.radiusY * scale}
          rotation={mask.rotation}
          {...commonProps}
        />
        {isSelected && (
          <Transformer ref={trRef} boundBoxFunc={(oldBox, newBox) => newBox} onMouseEnter={onMaskMouseEnter} onMouseLeave={onMaskMouseLeave} />
        )}
      </>
    );
  }

  if (mask.type === 'linear') {
    const { startX, startY, endX, endY } = mask.geometry;
    return (
      <Line
        points={[startX * scale, startY * scale, endX * scale, endY * scale]}
        rotation={mask.rotation}
        {...commonProps}
        draggable={false}
      />
    );
  }
  return null;
});

const EditorToolbar = memo(({ onBackToLibrary, selectedImage, isLoading, onToggleShowOriginal, showOriginal, onToggleFullScreen, isFullScreenLoading }) => (
  <div className="flex-shrink-0 flex justify-between items-center px-1">
    <button onClick={onBackToLibrary} className="bg-surface text-text-primary p-2 rounded-full hover:bg-card-active transition-colors" title="Back to Library">
      <ArrowLeft size={20} />
    </button>
    <div className="bg-surface text-text-secondary text-xs px-4 py-2 rounded-full select-none truncate flex items-center gap-2">
      <span className="font-medium text-text-primary truncate">{selectedImage.path.split(/[\/\\]/).pop()}</span>
      {isLoading && <Loader2 size={12} className="animate-spin" />}
      {selectedImage.width > 0 && ` - ${selectedImage.width} × ${selectedImage.height}`}
    </div>
    <div className="flex items-center gap-2">
      <button onClick={onToggleShowOriginal} className="bg-surface text-text-primary p-2 rounded-full hover:bg-card-active transition-colors" title={showOriginal ? "Show Edited (.)" : "Show Original (.)"}>
        {showOriginal ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
      <button onClick={onToggleFullScreen} className="bg-surface text-text-primary p-2 rounded-full hover:bg-card-active transition-colors" title="Toggle Fullscreen (F)" disabled={isFullScreenLoading}>
        {isFullScreenLoading ? <Loader2 size={20} className="animate-spin" /> : <Maximize size={20} />}
      </button>
    </div>
  </div>
));

const ImageCanvas = memo(({
  isCropping, crop, setCrop, handleCropComplete, adjustments, selectedImage,
  isMasking, imageRenderSize, showOriginal, finalPreviewUrl, isAdjusting,
  uncroppedAdjustedPreviewUrl, thumbnailData,
  onSelectMask, activeMaskId, handleUpdateMask, isMaskHovered, setIsMaskHovered
}) => {
  const [isCropViewVisible, setIsCropViewVisible] = useState(false);
  const imagePathRef = useRef(null);
  const latestEditedUrlRef = useRef(null);
  const [layers, setLayers] = useState([]);

  // Effect to manage all layer changes: new image, new preview, or toggling original
  useEffect(() => {
    const currentImagePath = selectedImage.path;
    const originalUrl = selectedImage.originalUrl;
    const topLayer = layers[layers.length - 1];

    // 1. On new image selection, reset everything.
    if (currentImagePath !== imagePathRef.current) {
      imagePathRef.current = currentImagePath;
      const initialUrl = finalPreviewUrl || originalUrl || thumbnailData;
      if (initialUrl) {
        latestEditedUrlRef.current = initialUrl;
        setLayers([{ id: initialUrl, url: initialUrl, opacity: 1 }]);
      } else {
        setLayers([]);
      }
      return;
    }

    // 2. Handle toggling "Show Original"
    if (showOriginal && topLayer?.id !== 'original') {
      setLayers(prev => [...prev, { id: 'original', url: originalUrl, opacity: 0 }]);
      return;
    }
    if (!showOriginal && topLayer?.id === 'original') {
      setLayers(prev => [...prev, { id: latestEditedUrlRef.current, url: latestEditedUrlRef.current, opacity: 0 }]);
      return;
    }

    // 3. Handle new edited preview URL
    if (finalPreviewUrl && finalPreviewUrl !== latestEditedUrlRef.current) {
      latestEditedUrlRef.current = finalPreviewUrl;
      const img = new Image();
      img.src = finalPreviewUrl;
      img.onload = () => {
        if (img.src === latestEditedUrlRef.current) {
          setLayers(prev => [...prev, { id: img.src, url: img.src, opacity: 0 }]);
        }
      };
      return () => { img.onload = null; };
    }
  }, [selectedImage, finalPreviewUrl, thumbnailData, showOriginal, layers]);

  // Effect for triggering the fade-in of a new layer
  useEffect(() => {
    const layerToFadeIn = layers.find(l => l.opacity === 0);
    if (layerToFadeIn) {
      queueMicrotask(() => {
        setLayers(prev =>
          prev.map(l => (l.id === layerToFadeIn.id ? { ...l, opacity: 1 } : l))
        );
      });
    }
  }, [layers]);

  const handleTransitionEnd = useCallback((finishedId) => {
    setLayers(prev => prev.length > 1 ? prev.filter(l => l.id === finishedId) : prev);
  }, []);

  useEffect(() => {
    if (isCropping) {
      const timer = setTimeout(() => setIsCropViewVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsCropViewVisible(false);
    }
  }, [isCropping]);

  const cropPreviewUrl = uncroppedAdjustedPreviewUrl || selectedImage.originalUrl;
  const isContentReady = layers.length > 0;

  return (
    <div className="relative" style={{ width: imageRenderSize.width, height: imageRenderSize.height }}>
      {/* Main Image View */}
      <div
        className="absolute inset-0 w-full h-full transition-opacity duration-200"
        style={{
          opacity: isCropViewVisible ? 0 : 1,
          pointerEvents: isCropViewVisible ? 'none' : 'auto',
        }}
      >
        <div
          className={clsx(
            "absolute inset-0 w-full h-full transition-opacity duration-300",
            isAdjusting && !showOriginal ? 'opacity-70' : 'opacity-100'
          )}
          style={{ opacity: isContentReady ? 1 : 0 }}
        >
          <div className="absolute inset-0 w-full h-full">
            {layers.map(layer => (
              <img
                key={layer.id}
                src={layer.url}
                alt={layer.id === 'original' ? 'Original' : 'Edited'}
                onTransitionEnd={() => handleTransitionEnd(layer.id)}
                className="absolute inset-0 w-full h-full object-contain"
                style={{
                  opacity: layer.opacity,
                  transition: 'opacity 150ms ease-in-out',
                }}
              />
            ))}
          </div>
        </div>

        {isMasking && imageRenderSize.width > 0 && (
          <Stage
            width={imageRenderSize.width}
            height={imageRenderSize.height}
            className="absolute top-0 left-0 transition-opacity duration-300"
            style={{
              zIndex: 4,
              opacity: showOriginal ? 0 : 1,
              pointerEvents: showOriginal ? 'none' : 'auto',
            }}
            onMouseDown={(e) => e.target === e.target.getStage() && onSelectMask(null)}
          >
            <Layer>
              {adjustments.masks.map(mask => (
                <MaskOverlay
                  key={mask.id}
                  mask={mask}
                  scale={imageRenderSize.scale}
                  onUpdate={handleUpdateMask}
                  isSelected={mask.id === activeMaskId}
                  onSelect={() => onSelectMask(mask.id)}
                  onMaskMouseEnter={() => setIsMaskHovered(true)}
                  onMaskMouseLeave={() => setIsMaskHovered(false)}
                />
              ))}
            </Layer>
          </Stage>
        )}
      </div>

      {/* Crop View */}
      <div
        className="absolute inset-0 w-full h-full flex items-center justify-center transition-opacity duration-200"
        style={{
          opacity: isCropViewVisible ? 1 : 0,
          pointerEvents: isCropViewVisible ? 'auto' : 'none',
        }}
      >
        {cropPreviewUrl && (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={handleCropComplete}
              aspect={adjustments.aspectRatio}
            >
              <img
                alt="Crop preview"
                src={cropPreviewUrl}
                style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            </ReactCrop>
          </div>
        )}
      </div>
    </div>
  );
});

export default function Editor({
  selectedImage, finalPreviewUrl, uncroppedAdjustedPreviewUrl,
  showOriginal, setShowOriginal, isAdjusting, onBackToLibrary, isLoading, isFullScreen,
  isFullScreenLoading, fullScreenUrl, onToggleFullScreen, activeRightPanel, renderedRightPanel,
  adjustments, setAdjustments, thumbnails, activeMaskId, onSelectMask,
  transformWrapperRef, onZoomed, onContextMenu
}) {
  const [crop, setCrop] = useState();
  const [isMaskHovered, setIsMaskHovered] = useState(false);
  const [isLoaderVisible, setIsLoaderVisible] = useState(false);
  const imageContainerRef = useRef(null);
  const isInitialMount = useRef(true);

  // Auto-revert from "Show Original" when a new adjustment is made.
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (showOriginal) {
      setShowOriginal(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalPreviewUrl]); // This should ONLY run when finalPreviewUrl changes.

  const isCropping = renderedRightPanel === 'crop';
  const isMasking = renderedRightPanel === 'masks';
  const thumbnailData = thumbnails[selectedImage?.path];
  
  const showSpinner = isLoading && !finalPreviewUrl && !thumbnailData && !selectedImage.originalUrl;

  const imageRenderSize = useImageRenderSize(imageContainerRef, selectedImage);

  useEffect(() => {
    let timer;
    if (showSpinner) {
      setIsLoaderVisible(true);
    } else {
      timer = setTimeout(() => setIsLoaderVisible(false), 300);
    }
    return () => clearTimeout(timer);
  }, [showSpinner]);

  useEffect(() => {
    if (!isCropping || !selectedImage) {
      setCrop(undefined);
      return;
    }
    const { width: originalWidth, height: originalHeight } = selectedImage;
    if (!originalWidth || !originalHeight) return;

    if (adjustments.crop) {
      const { x, y, width, height } = adjustments.crop;
      setCrop({ unit: '%', x: (x / originalWidth) * 100, y: (y / originalHeight) * 100, width: (width / originalWidth) * 100, height: (height / originalHeight) * 100 });
    } else {
      setCrop(adjustments.aspectRatio
        ? centerAspectCrop(originalWidth, originalHeight, adjustments.aspectRatio)
        : { unit: '%', width: 100, height: 100, x: 0, y: 0 }
      );
    }
  }, [isCropping, adjustments.crop, adjustments.aspectRatio, selectedImage]);

  const handleCropComplete = useCallback((_, pc) => {
    if (!pc.width || !pc.height || !selectedImage?.width) return;
    const { width: originalWidth, height: originalHeight } = selectedImage;
    const pixelCrop = {
      x: Math.round((pc.x / 100) * originalWidth),
      y: Math.round((pc.y / 100) * originalHeight),
      width: Math.round((pc.width / 100) * originalWidth),
      height: Math.round((pc.height / 100) * originalHeight),
    };
    const isFullImageCrop = pixelCrop.x === 0 && pixelCrop.y === 0 && pixelCrop.width === originalWidth && pixelCrop.height === originalHeight;

    if (isFullImageCrop && !adjustments.aspectRatio) {
      if (adjustments.crop !== null) setAdjustments(prev => ({ ...prev, crop: null }));
    } else if (JSON.stringify(pixelCrop) !== JSON.stringify(adjustments.crop)) {
      setAdjustments(prev => ({ ...prev, crop: pixelCrop }));
    }
  }, [selectedImage, adjustments.aspectRatio, adjustments.crop, setAdjustments]);

  const handleUpdateMask = useCallback((id, newProps) => {
    setAdjustments(prev => ({
      ...prev,
      masks: prev.masks.map(m => m.id === id ? { ...m, ...newProps } : m),
    }));
  }, [setAdjustments]);

  const toggleShowOriginal = useCallback(() => setShowOriginal(prev => !prev), [setShowOriginal]);

  useKeydown('f', onToggleFullScreen, !isFullScreen);
  useKeydown('.', toggleShowOriginal);

  if (!selectedImage) {
    return (
      <div className="flex-1 bg-bg-secondary rounded-lg flex items-center justify-center text-text-secondary">
        <p>Select an image from the library to begin editing.</p>
      </div>
    );
  }

  return (
    <>
      {isFullScreen && (
        <FullScreenViewer key={selectedImage.path} url={fullScreenUrl} isLoading={isFullScreenLoading} onClose={onToggleFullScreen} />
      )}
      <div className="flex-1 bg-bg-secondary rounded-lg flex flex-col relative overflow-hidden p-2 gap-2 min-h-0">
        <EditorToolbar
          onBackToLibrary={onBackToLibrary}
          selectedImage={selectedImage}
          isLoading={isLoading}
          onToggleShowOriginal={toggleShowOriginal}
          showOriginal={showOriginal}
          onToggleFullScreen={onToggleFullScreen}
          isFullScreenLoading={isFullScreenLoading}
        />

        <div 
          className="flex-1 relative overflow-hidden rounded-lg" 
          ref={imageContainerRef}
          onContextMenu={(e) => onContextMenu(e, selectedImage.path)}
        >
          {showSpinner && (
            <div className={clsx(
              "absolute inset-0 bg-bg-secondary/80 flex items-center justify-center z-50 transition-opacity duration-300",
              isLoaderVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}>
              <Loader2 size={48} className="animate-spin text-accent" />
            </div>
          )}

          <TransformWrapper
            key={selectedImage.path}
            ref={transformWrapperRef}
            minScale={0.7}
            maxScale={10}
            limitToBounds={true}
            centerZoomedOut={true}
            doubleClick={{ disabled: true }}
            panning={{ disabled: isMaskHovered || isCropping }}
            onTransformed={(_, state) => onZoomed(state)}
          >
            <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ImageCanvas
                isCropping={isCropping}
                crop={crop}
                setCrop={setCrop}
                handleCropComplete={handleCropComplete}
                adjustments={adjustments}
                selectedImage={selectedImage}
                isMasking={isMasking}
                imageRenderSize={imageRenderSize}
                showOriginal={showOriginal}
                finalPreviewUrl={finalPreviewUrl}
                isAdjusting={isAdjusting}
                uncroppedAdjustedPreviewUrl={uncroppedAdjustedPreviewUrl}
                thumbnailData={thumbnailData}
                onSelectMask={onSelectMask}
                activeMaskId={activeMaskId}
                handleUpdateMask={handleUpdateMask}
                isMaskHovered={isMaskHovered}
                setIsMaskHovered={setIsMaskHovered}
              />
            </TransformComponent>
          </TransformWrapper>
        </div>
      </div>
    </>
  );
}