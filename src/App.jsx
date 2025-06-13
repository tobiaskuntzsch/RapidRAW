import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
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
  const [selectedImage, setSelectedImage] = useState(null);
  const [quickPreviewUrl, setQuickPreviewUrl] = useState(null);
  const [finalPreviewUrl, setFinalPreviewUrl] = useState(null);
  const [adjustments, setAdjustments] = useState(INITIAL_ADJUSTMENTS);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [error, setError] = useState(null);

  const applyAdjustments = useCallback(debounce((currentAdjustments) => {
    if (!selectedImage) return;
    
    setIsAdjusting(true);
    setError(null);
    
    invoke('apply_adjustments', { 
      jsAdjustments: currentAdjustments 
    }).catch(err => {
      console.error("Failed to invoke apply_adjustments:", err);
      setError(`Processing failed: ${err}`);
      setIsAdjusting(false);
    });
  }, 200), [selectedImage]);

  useEffect(() => {
    const unlistenQuick = listen('preview-update-quick', (event) => {
      setQuickPreviewUrl(event.payload);
    });
    const unlistenFinal = listen('preview-update-final', (event) => {
      setFinalPreviewUrl(event.payload);
      setIsAdjusting(false);
    });

    return () => {
      unlistenQuick.then(f => f());
      unlistenFinal.then(f => f());
    };
  }, []);

  useEffect(() => {
    if (selectedImage) {
      applyAdjustments(adjustments);
    }
    return () => applyAdjustments.cancel();
  }, [adjustments, selectedImage, applyAdjustments]);

  const handleImageSelect = async (path) => {
    try {
      setIsAppLoading(true);
      setError(null);
      
      await invoke('load_image', { path });
      
      const originalUrl = convertFileSrc(path);
      
      setSelectedImage({ path, originalUrl });
      setAdjustments(INITIAL_ADJUSTMENTS);
      
      setQuickPreviewUrl(originalUrl);
      setFinalPreviewUrl(originalUrl);
      setShowOriginal(false);

    } catch (error) {
      console.error("Failed to load image:", error);
      setError(`Failed to load image: ${error}`);
      setSelectedImage(null);
      setQuickPreviewUrl(null);
      setFinalPreviewUrl(null);
    } finally {
      setIsAppLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-bg-primary font-sans">
      {isAppLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="text-white text-xl">Loading Image...</div>
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
        quickPreviewUrl={quickPreviewUrl}
        finalPreviewUrl={finalPreviewUrl}
        showOriginal={showOriginal}
        setShowOriginal={setShowOriginal}
        isAdjusting={isAdjusting}
      />
      <Controls
        adjustments={adjustments}
        setAdjustments={setAdjustments}
        selectedImage={selectedImage}
      />
    </div>
  );
}

export default App;