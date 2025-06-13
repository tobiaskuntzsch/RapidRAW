import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import debounce from 'lodash.debounce';

import Library from './components/Library';
import Editor from './components/Editor';
import Controls from './components/Controls';

const INITIAL_ADJUSTMENTS = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  curve_points: [
    { x: 0, y: 0 },
    { x: 128, y: 128 },
    { x: 255, y: 255 },
  ],
};

function App() {
  const [imageList, setImageList] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null); // { path, originalUrl }
  const [processedImageUrl, setProcessedImageUrl] = useState(null);
  const [adjustments, setAdjustments] = useState(INITIAL_ADJUSTMENTS);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // This function calls the Rust backend to apply adjustments.
  // It's wrapped in `useCallback` and `debounce` for performance.
  const applyAdjustments = useCallback(debounce(async (currentAdjustments) => {
    if (!selectedImage) return;
    
    console.log('Applying adjustments:', currentAdjustments);
    setIsLoading(true);
    setError(null);
    
    try {
      // Fix: Use jsAdjustments (camelCase) - Tauri converts to js_adjustments (snake_case) in Rust
      const url = await invoke('apply_adjustments', { 
        jsAdjustments: currentAdjustments 
      });
      console.log('Received processed image URL:', url?.substring(0, 50) + '...');
      setProcessedImageUrl(url);
    } catch (error) {
      console.error("Failed to apply adjustments:", error);
      setError(`Processing failed: ${error}`);
      // Fallback to original image if processing fails
      setProcessedImageUrl(selectedImage.originalUrl);
    } finally {
      setIsLoading(false);
    }
  }, 200), [selectedImage]); // Debounce time: 200ms

  // Effect to run when adjustments change
  useEffect(() => {
    if (selectedImage) {
      applyAdjustments(adjustments);
    }
    // Cleanup function to cancel any pending debounced calls
    return () => applyAdjustments.cancel();
  }, [adjustments, selectedImage, applyAdjustments]);

  const handleImageSelect = async (path) => {
    try {
      console.log('Loading image:', path);
      setIsLoading(true);
      setError(null);
      
      // Ask Rust to load the image into memory
      const dimensions = await invoke('load_image', { path });
      console.log('Image loaded with dimensions:', dimensions);
      
      // Get a URL for the original image to display it
      const originalUrl = convertFileSrc(path);
      console.log('Original URL:', originalUrl);
      
      setSelectedImage({ path, originalUrl });
      
      // Reset adjustments for the new image (this will trigger useEffect)
      setAdjustments(INITIAL_ADJUSTMENTS);
      
      // Initially show the original image
      setProcessedImageUrl(originalUrl);
      setShowOriginal(false);

    } catch (error) {
      console.error("Failed to load image:", error);
      setError(`Failed to load image: ${error}`);
      setSelectedImage(null);
      setProcessedImageUrl(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-bg-primary font-sans">
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="text-white text-xl">Processing...</div>
        </div>
      )}
      
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded z-50">
          {error}
          <button 
            onClick={() => setError(null)} 
            className="ml-2 text-white hover:text-gray-200"
          >
            ×
          </button>
        </div>
      )}
      
      <Library
        imageList={imageList}
        setImageList={setImageList}
        onImageSelect={handleImageSelect}
      />
      <Editor
        selectedImage={selectedImage}
        processedImageUrl={processedImageUrl}
        showOriginal={showOriginal}
        setShowOriginal={setShowOriginal}
      />
      <Controls
        adjustments={adjustments}
        setAdjustments={setAdjustments}
        processedImageUrl={processedImageUrl}
        selectedImage={selectedImage}
      />
    </div>
  );
}

export default App;