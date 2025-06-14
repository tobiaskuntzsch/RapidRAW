import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import debounce from 'lodash.debounce';

import Library from './components/Library';
import Editor from './components/Editor';
import Controls from './components/Controls';

const INITIAL_ADJUSTMENTS = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  saturation: 0,
  hue: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  hsl: {
    reds: { hue: 0, saturation: 0, luminance: 0 },
    oranges: { hue: 0, saturation: 0, luminance: 0 },
    yellows: { hue: 0, saturation: 0, luminance: 0 },
    greens: { hue: 0, saturation: 0, luminance: 0 },
    aquas: { hue: 0, saturation: 0, luminance: 0 },
    blues: { hue: 0, saturation: 0, luminance: 0 },
    purples: { hue: 0, saturation: 0, luminance: 0 },
    magentas: { hue: 0, saturation: 0, luminance: 0 },
  },
  curves: {
    luma: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  },
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
  const [histogram, setHistogram] = useState(null);

  const applyAdjustments = useCallback(debounce((currentAdjustments) => {
    if (!selectedImage) return;
    
    setIsAdjusting(true);
    setError(null);
    
    const payload = { ...currentAdjustments };
    delete payload.curve_points;

    const previewPromise = invoke('apply_adjustments', { 
      jsAdjustments: payload 
    });

    const histogramPromise = invoke('generate_processed_histogram', {
      jsAdjustments: payload
    });

    histogramPromise
      .then(newHistData => {
        setHistogram(newHistData);
      })
      .catch(err => {
        console.error("Failed to generate processed histogram:", err);
      });

    previewPromise.catch(err => {
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
      setHistogram(null);
      
      await invoke('load_image', { path });
      
      const histData = await invoke('generate_histogram');
      setHistogram(histData);

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
        histogram={histogram}
      />
    </div>
  );
}

export default App;