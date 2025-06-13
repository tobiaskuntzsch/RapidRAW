import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Eye, EyeOff } from 'lucide-react';

export default function Editor({ selectedImage, processedImageUrl, showOriginal, setShowOriginal }) {
  if (!selectedImage) {
    return (
      <div className="panel-center items-center justify-center text-text-secondary">
        <p>Select an image from the library to begin editing.</p>
      </div>
    );
  }

  return (
    <div className="panel-center">
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={() => setShowOriginal(!showOriginal)}
          className="btn-icon"
          title={showOriginal ? "Show Edited Image" : "Show Original Image"}
        >
          {showOriginal ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      <TransformWrapper>
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <img
            key={showOriginal ? selectedImage.path : processedImageUrl}
            src={showOriginal ? selectedImage.originalUrl : processedImageUrl}
            alt="Editable"
            className="max-w-full max-h-full object-contain shadow-2xl"
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}