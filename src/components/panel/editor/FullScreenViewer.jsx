import { useState, useEffect, useCallback, memo } from 'react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { X, Loader2 } from 'lucide-react';
import { useKeydown } from '../../../hooks/useKeydown';

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
      className={`
        fixed inset-0 z-[100] flex items-center justify-center
        bg-black/60 backdrop-blur-sm
        transition-opacity duration-300 ease-in-out
        ${isAnimating ? 'opacity-100' : 'opacity-0'}
      `}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        className={`
          absolute top-4 right-4 text-white hover:text-gray-300 z-[102]
          transition-opacity duration-300
          ${isAnimating ? 'opacity-100' : 'opacity-0'}
        `}
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
        title="Close (Esc or F)"
      >
        <X size={32} />
      </button>

      <div
        className={`
          w-full h-full flex items-center justify-center
          transform transition-all duration-300 ease-out
          ${isAnimating ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 -translate-y-4'}
        `}
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

export default FullScreenViewer;