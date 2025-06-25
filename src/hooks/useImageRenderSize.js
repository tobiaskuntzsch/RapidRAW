import { useState, useEffect } from 'react';

export const useImageRenderSize = (containerRef, imageDimensions) => {
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0, scale: 1, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const { width: imgWidth, height: imgHeight } = imageDimensions || {};
    if (!container || !imgWidth || !imgHeight) {
        if (renderSize.width !== 0 || renderSize.height !== 0) {
            setRenderSize({ width: 0, height: 0, scale: 1, offsetX: 0, offsetY: 0 });
        }
        return;
    };

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
      
      const offsetX = (containerWidth - width) / 2;
      const offsetY = (containerHeight - height) / 2;

      setRenderSize({ width, height, scale: width / imgWidth, offsetX, offsetY });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [containerRef, imageDimensions]);

  return renderSize;
};