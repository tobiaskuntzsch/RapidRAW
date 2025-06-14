import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { homeDir } from '@tauri-apps/api/path';
import debounce from 'lodash.debounce';
import MainLibrary from './components/MainLibrary';
import FolderTree from './components/FolderTree';
import Editor from './components/Editor';
import Controls from './components/Controls';
import Filmstrip from './components/Filmstrip';
import { useThumbnails } from './hooks/useThumbnails';

const INITIAL_ADJUSTMENTS = {
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  saturation: 0, hue: 0, temperature: 0, tint: 0, vibrance: 0,
  hsl: {
    reds: { hue: 0, saturation: 0, luminance: 0 }, oranges: { hue: 0, saturation: 0, luminance: 0 },
    yellows: { hue: 0, saturation: 0, luminance: 0 }, greens: { hue: 0, saturation: 0, luminance: 0 },
    aquas: { hue: 0, saturation: 0, luminance: 0 }, blues: { hue: 0, saturation: 0, luminance: 0 },
    purples: { hue: 0, saturation: 0, luminance: 0 }, magentas: { hue: 0, saturation: 0, luminance: 0 },
  },
  curves: {
    luma: [{ x: 0, y: 0 }, { x: 255, y: 255 }], red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    green: [{ x: 0, y: 0 }, { x: 255, y: 255 }], blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  },
};

function App() {
  const [rootPath, setRootPath] = useState(null);
  const [currentFolderPath, setCurrentFolderPath] = useState(null);
  const [folderTree, setFolderTree] = useState(null);
  const [imageList, setImageList] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [quickPreviewUrl, setQuickPreviewUrl] = useState(null);
  const [finalPreviewUrl, setFinalPreviewUrl] = useState(null);
  const [adjustments, setAdjustments] = useState(INITIAL_ADJUSTMENTS);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isTreeLoading, setIsTreeLoading] = useState(false);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [error, setError] = useState(null);
  const [histogram, setHistogram] = useState(null);
  const [isFilmstripVisible, setIsFilmstripVisible] = useState(true);
  const [isFolderTreeVisible, setIsFolderTreeVisible] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(null);
  const [isAdjusting, setIsAdjusting] = useState(false);

  const { thumbnails } = useThumbnails(imageList);

  const loaderTimeoutRef = useRef(null);
  const folderTreeTimeoutRef = useRef(null);

  useEffect(() => {
    const listeners = [
      listen('preview-update-quick', (event) => setQuickPreviewUrl(event.payload)),
      listen('preview-update-final', (event) => {
        setFinalPreviewUrl(event.payload);
        setIsAdjusting(false);
      }),
      listen('folder-tree-update', (event) => {
        setFolderTree(event.payload);
        setIsTreeLoading(false);
        if (folderTreeTimeoutRef.current) clearTimeout(folderTreeTimeoutRef.current);
        if (loadingTimeout) clearTimeout(loadingTimeout);
      }),
      listen('folder-tree-error', (event) => {
        setError(`Failed to load folder tree: ${event.payload}`);
        setIsTreeLoading(false);
        if (folderTreeTimeoutRef.current) clearTimeout(folderTreeTimeoutRef.current);
        if (loadingTimeout) clearTimeout(loadingTimeout);
      }),
      listen('export-failed', (event) => setError(`Export failed: ${event.payload}`)),
      listen('export-successful', (event) => console.log(`Export successful to ${event.payload}`))
    ];
  
    return () => {
      listeners.forEach(unlistenPromise => unlistenPromise.then(unlisten => unlisten()));
      if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);
      if (folderTreeTimeoutRef.current) clearTimeout(folderTreeTimeoutRef.current);
    };
  }, [loadingTimeout]);

  const applyAdjustments = useCallback(debounce((currentAdjustments) => {
    if (!selectedImage) return;
    setIsAdjusting(true);
    setError(null);
    invoke('apply_adjustments', { jsAdjustments: currentAdjustments }).catch(err => {
      console.error("Failed to invoke apply_adjustments:", err);
      setError(`Processing failed: ${err}`);
      setIsAdjusting(false);
    });
    invoke('generate_processed_histogram', { jsAdjustments: currentAdjustments })
      .then(setHistogram)
      .catch(err => console.error("Failed to generate processed histogram:", err));
  }, 200), [selectedImage]);

  useEffect(() => {
    if (selectedImage) {
      applyAdjustments(adjustments);
    }
    return () => applyAdjustments.cancel();
  }, [adjustments, selectedImage, applyAdjustments]);

  const handleOpenFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, defaultPath: await homeDir() });
      if (typeof selected === 'string') {
        setRootPath(selected);
        await handleSelectSubfolder(selected, true);
      }
    } catch (err) {
      console.error("Failed to open directory dialog:", err);
      setError("Failed to open folder selection dialog.");
    }
  };

  const handleSelectSubfolder = async (path, isNewRoot = false) => {
    setIsViewLoading(true);
    if (loadingTimeout) clearTimeout(loadingTimeout);
    
    try {
      setCurrentFolderPath(path);
      const promises = [invoke('list_images_in_dir', { path })];

      if (isNewRoot) {
        setIsTreeLoading(true);
        setFolderTree(null);
        
        const timeoutId = setTimeout(() => {
          setIsTreeLoading(false);
          setError('Folder tree loading timed out. Please try again.');
        }, 10000);
        
        setLoadingTimeout(timeoutId);
        folderTreeTimeoutRef.current = timeoutId;

        invoke('get_folder_tree', { path }).catch(err => {
          clearTimeout(timeoutId);
          setIsTreeLoading(false);
          setError(`Failed to load folder tree: ${err}`);
        });
      }

      const [files] = await Promise.all(promises);
      setImageList(files);

      if (selectedImage) {
        setSelectedImage(null);
        setFinalPreviewUrl(null);
        setQuickPreviewUrl(null);
        setHistogram(null);
      }
    } catch (err) {
      console.error("Failed to load folder contents:", err);
      setError("Failed to load images from the selected folder.");
      setIsTreeLoading(false);
    } finally {
      setIsViewLoading(false);
    }
  };

  const handleImageSelect = async (path) => {
    if (selectedImage?.path === path) return;
    if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);
    loaderTimeoutRef.current = setTimeout(() => setIsViewLoading(true), 150);

    try {
      setError(null);
      setHistogram(null);
      setQuickPreviewUrl(null);
      setFinalPreviewUrl(null);

      const loadImageResult = await invoke('load_image', { path });
      const histData = await invoke('generate_histogram');
      setHistogram(histData);
      
      setSelectedImage({ path, originalUrl: loadImageResult.original_base64 });
      setAdjustments(INITIAL_ADJUSTMENTS);
      setShowOriginal(false);
    } catch (err) {
      console.error("Failed to load image:", err);
      setError(`Failed to load image: ${err}`);
      setSelectedImage(null);
    } finally {
      if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);
      setIsViewLoading(false);
    }
  };

  const handleBackToLibrary = () => {
    setSelectedImage(null);
    setFinalPreviewUrl(null);
    setQuickPreviewUrl(null);
    setHistogram(null);
  };

  return (
    <div className="flex flex-col h-screen bg-bg-primary font-sans text-text-primary overflow-hidden p-2 gap-2">
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg z-50">
          {error}
          <button onClick={() => setError(null)} className="ml-4 font-bold hover:text-gray-200">×</button>
        </div>
      )}

      {selectedImage ? (
        <div className="flex flex-row flex-grow h-full min-h-0 gap-2">
          <FolderTree 
            tree={folderTree} 
            onFolderSelect={handleSelectSubfolder} 
            selectedPath={currentFolderPath} 
            isLoading={isTreeLoading}
            isVisible={isFolderTreeVisible}
            setIsVisible={setIsFolderTreeVisible}
          />
          <div className="flex-1 flex flex-col relative min-w-0 gap-2">
            <Editor
              selectedImage={selectedImage}
              quickPreviewUrl={quickPreviewUrl}
              finalPreviewUrl={finalPreviewUrl}
              showOriginal={showOriginal}
              setShowOriginal={setShowOriginal}
              isAdjusting={isAdjusting}
              onBackToLibrary={handleBackToLibrary}
              isLoading={isViewLoading}
            />
            <Filmstrip
              imageList={imageList}
              selectedImage={selectedImage}
              onImageSelect={handleImageSelect}
              isVisible={isFilmstripVisible}
              setIsVisible={setIsFilmstripVisible}
              isLoading={isViewLoading}
              thumbnails={thumbnails}
            />
          </div>
          <Controls
            adjustments={adjustments}
            setAdjustments={setAdjustments}
            selectedImage={selectedImage}
            histogram={histogram}
          />
        </div>
      ) : (
        <MainLibrary
          imageList={imageList}
          onImageSelect={handleImageSelect}
          rootPath={rootPath}
          currentFolderPath={currentFolderPath}
          folderTree={folderTree}
          onFolderSelect={handleSelectSubfolder}
          onOpenFolder={handleOpenFolder}
          isTreeLoading={isTreeLoading}
          isLoading={isViewLoading}
          thumbnails={thumbnails}
        />
      )}
    </div>
  );
}

export default App;