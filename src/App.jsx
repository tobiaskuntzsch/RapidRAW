import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { homeDir } from '@tauri-apps/api/path';
import debounce from 'lodash.debounce';
import TitleBar from './window/TitleBar';
import MainLibrary from './components/panel/MainLibrary';
import FolderTree from './components/panel/FolderTree';
import Editor from './components/panel/Editor';
import Controls from './components/panel/Controls';
import Filmstrip from './components/panel/Filmstrip';
import { useThumbnails } from './hooks/useThumbnails';
import RightPanelSwitcher from './components/panel/RightPanelSwitcher';
import MetadataPanel from './components/panel/MetadataPanel';
import CropPanel from './components/panel/CropPanel';
import AIPanel from './components/panel/AIPanel';


export const INITIAL_ADJUSTMENTS = {
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  saturation: 0, temperature: 0, tint: 0, vibrance: 0,
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
  crop: null,
  aspectRatio: null,
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

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isFullScreenLoading, setIsFullScreenLoading] = useState(false);
  const [fullScreenUrl, setFullScreenUrl] = useState(null);

  const [activeRightPanel, setActiveRightPanel] = useState('adjustments');

  const { thumbnails } = useThumbnails(imageList);

  const loaderTimeoutRef = useRef(null);
  const folderTreeTimeoutRef = useRef(null);

  const handleRightPanelSelect = (panelId) => {
    if (panelId === activeRightPanel) {
      setActiveRightPanel(null);
    } else {
      setActiveRightPanel(panelId);
    }
  };

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
    if (!selectedImage?.isReady) return;
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

  const debouncedSave = useCallback(debounce((path, adjustmentsToSave) => {
    invoke('save_metadata_and_update_thumbnail', { path, adjustments: adjustmentsToSave }).catch(err => {
        console.error("Auto-save failed:", err);
        setError(`Failed to save changes: ${err}`);
    });
  }, 1500), []);

  useEffect(() => {
    if (selectedImage?.isReady) {
      applyAdjustments(adjustments);
      debouncedSave(selectedImage.path, adjustments);
    }
    return () => {
      applyAdjustments.cancel();
      debouncedSave.cancel();
    }
  }, [adjustments, selectedImage, applyAdjustments, debouncedSave]);

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

    applyAdjustments.cancel();
    debouncedSave.cancel();

    setSelectedImage({ path, originalUrl: null, isReady: false, width: 0, height: 0, metadata: null });
    setIsViewLoading(true);
    setError(null);
    setHistogram(null);
    setQuickPreviewUrl(null);
    setFinalPreviewUrl(null);
    setAdjustments(INITIAL_ADJUSTMENTS);
    setShowOriginal(false);

    try {
      const loadImageResult = await invoke('load_image', { path });
      const histData = await invoke('generate_histogram');
      
      setSelectedImage(currentSelected => {
        if (currentSelected && currentSelected.path === path) {
          setHistogram(histData);
          return { 
            ...currentSelected, 
            originalUrl: loadImageResult.original_base64,
            width: loadImageResult.width,
            height: loadImageResult.height,
            metadata: loadImageResult.metadata,
            isReady: true 
          };
        }
        return currentSelected;
      });

      if (loadImageResult.metadata.adjustments && !loadImageResult.metadata.adjustments.is_null) {
        // Deep merge with initial adjustments to ensure all keys are present
        setAdjustments(prev => ({
          ...INITIAL_ADJUSTMENTS,
          ...prev,
          ...loadImageResult.metadata.adjustments,
          hsl: { ...INITIAL_ADJUSTMENTS.hsl, ...loadImageResult.metadata.adjustments.hsl },
          curves: { ...INITIAL_ADJUSTMENTS.curves, ...loadImageResult.metadata.adjustments.curves },
        }));
      } else {
        setAdjustments(INITIAL_ADJUSTMENTS);
      }

    } catch (err) {
      console.error("Failed to load image:", err);
      setError(`Failed to load image: ${err}`);
      setSelectedImage(null);
    } finally {
      setIsViewLoading(false);
    }
  };

  const handleBackToLibrary = () => {
    setSelectedImage(null);
    setFinalPreviewUrl(null);
    setQuickPreviewUrl(null);
    setHistogram(null);
  };

  const handleToggleFullScreen = async () => {
    if (isFullScreen) {
      setIsFullScreen(false);
      setFullScreenUrl(null);
    } else {
      setIsFullScreenLoading(true);
      try {
        const url = await invoke('generate_fullscreen_preview', { jsAdjustments: adjustments });
        setFullScreenUrl(url);
        setIsFullScreen(true);
      } catch (e) {
        console.error("Failed to generate fullscreen preview:", e);
        setError("Failed to generate full screen preview.");
      } finally {
        setIsFullScreenLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg-primary font-sans text-text-primary overflow-hidden">
      <TitleBar />

      <div className="flex-1 flex flex-col pt-12 p-2 gap-2 min-h-0">
        {error && (
          <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg z-50">
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
                isFullScreen={isFullScreen}
                isFullScreenLoading={isFullScreenLoading}
                fullScreenUrl={fullScreenUrl}
                onToggleFullScreen={handleToggleFullScreen}
                activeRightPanel={activeRightPanel}
                adjustments={adjustments}
                setAdjustments={setAdjustments}
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
            
            <div className={`flex items-start ${activeRightPanel ? 'gap-2' : ''}`}>
              <div className={`h-full transition-all duration-300 ease-in-out ${activeRightPanel ? 'w-80' : 'w-0'} overflow-hidden`}>
                <div className={activeRightPanel === 'adjustments' ? 'h-full' : 'hidden'}>
                  <Controls
                    adjustments={adjustments}
                    setAdjustments={setAdjustments}
                    selectedImage={selectedImage}
                    histogram={histogram}
                  />
                </div>
                <div className={activeRightPanel === 'metadata' ? 'h-full' : 'hidden'}>
                  <MetadataPanel selectedImage={selectedImage} />
                </div>
                <div className={activeRightPanel === 'crop' ? 'h-full' : 'hidden'}>
                  <CropPanel 
                    selectedImage={selectedImage} 
                    adjustments={adjustments}
                    setAdjustments={setAdjustments}
                  />
                </div>
                <div className={activeRightPanel === 'ai' ? 'h-full' : 'hidden'}>
                  <AIPanel selectedImage={selectedImage} />
                </div>
              </div>
              <RightPanelSwitcher 
                activePanel={activeRightPanel}
                onPanelSelect={handleRightPanelSelect}
              />
            </div>
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
    </div>
  );
}

export default App;