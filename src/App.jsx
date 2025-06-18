import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { homeDir } from '@tauri-apps/api/path';
import debounce from 'lodash.debounce';
import { centerCrop, makeAspectCrop } from 'react-image-crop';
import TitleBar from './window/TitleBar';
import MainLibrary from './components/panel/MainLibrary';
import FolderTree from './components/panel/FolderTree';
import Editor from './components/panel/Editor';
import Controls from './components/panel/right/Controls';
import { useThumbnails } from './hooks/useThumbnails';
import RightPanelSwitcher from './components/panel/right/RightPanelSwitcher';
import MetadataPanel from './components/panel/right/MetadataPanel';
import CropPanel from './components/panel/right/CropPanel';
import PresetsPanel from './components/panel/right/PresetsPanel';
import AIPanel from './components/panel/right/AIPanel';
import ExportPanel from './components/panel/right/ExportPanel';
import MasksPanel from './components/panel/right/MasksPanel';
import BottomBar from './components/panel/BottomBar';
import { ContextMenuProvider } from './context/ContextMenuContext';
import ContextMenu from './components/ui/ContextMenu';

export const INITIAL_MASK_ADJUSTMENTS = {
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  saturation: 0, temperature: 0, tint: 0, vibrance: 0,
};

export const INITIAL_ADJUSTMENTS = {
  rating: 0,
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
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
  masks: [],
};

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 100 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

function App() {
  const [rootPath, setRootPath] = useState(null);
  const [appSettings, setAppSettings] = useState(null);
  const [currentFolderPath, setCurrentFolderPath] = useState(null);
  const [folderTree, setFolderTree] = useState(null);
  const [imageList, setImageList] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [quickPreviewUrl, setQuickPreviewUrl] = useState(null);
  const [finalPreviewUrl, setFinalPreviewUrl] = useState(null);
  const [uncroppedAdjustedPreviewUrl, setUncroppedAdjustedPreviewUrl] = useState(null);
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
  const [activeMaskId, setActiveMaskId] = useState(null);
  const [copiedAdjustments, setCopiedAdjustments] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [renderedRightPanel, setRenderedRightPanel] = useState(activeRightPanel);
  const [collapsibleSectionsState, setCollapsibleSectionsState] = useState({
    basic: true,
    curves: true,
    color: false,
  });

  const { thumbnails } = useThumbnails(imageList);

  const loaderTimeoutRef = useRef(null);
  const folderTreeTimeoutRef = useRef(null);
  const transformWrapperRef = useRef(null);

  const handleRightPanelSelect = (panelId) => {
    if (panelId === activeRightPanel) {
      setActiveRightPanel(null);
    } else {
      setActiveRightPanel(panelId);
      setRenderedRightPanel(panelId);
    }
    setActiveMaskId(null);
  };

  const handleTransitionEnd = () => {
    if (activeRightPanel === null) {
      setRenderedRightPanel(null);
    }
  };

  useEffect(() => {
    invoke('load_settings')
      .then(setAppSettings)
      .catch(err => {
        console.error("Failed to load settings:", err);
        setAppSettings({ last_root_path: null });
      });
  }, []);

  useEffect(() => {
    let isEffectActive = true;

    const listeners = [
      listen('preview-update-quick', (event) => {
        if (isEffectActive) setQuickPreviewUrl(event.payload);
      }),
      listen('preview-update-final', (event) => {
        if (isEffectActive) {
          setFinalPreviewUrl(event.payload);
          setIsAdjusting(false);
        }
      }),
      listen('preview-update-uncropped', (event) => {
        if (isEffectActive) setUncroppedAdjustedPreviewUrl(event.payload);
      }),
      listen('histogram-update', (event) => {
        if (isEffectActive) setHistogram(event.payload);
      }),
      listen('folder-tree-update', (event) => {
        if (isEffectActive) {
          setFolderTree(event.payload);
          setIsTreeLoading(false);
          if (folderTreeTimeoutRef.current) clearTimeout(folderTreeTimeoutRef.current);
          if (loadingTimeout) clearTimeout(loadingTimeout);
        }
      }),
      listen('folder-tree-error', (event) => {
        if (isEffectActive) {
          setError(`Failed to load folder tree: ${event.payload}`);
          setIsTreeLoading(false);
          if (folderTreeTimeoutRef.current) clearTimeout(folderTreeTimeoutRef.current);
          if (loadingTimeout) clearTimeout(loadingTimeout);
        }
      }),
      listen('export-failed', (event) => {
        if (isEffectActive) setError(`Export failed: ${event.payload}`);
      }),
      listen('export-successful', (event) => {
        if (isEffectActive) console.log(`Export successful to ${event.payload}`);
      })
    ];

    return () => {
      isEffectActive = false;
      listeners.forEach(unlistenPromise => unlistenPromise.then(unlisten => unlisten()));
      if (loaderTimeoutRef.current) clearTimeout(loaderTimeoutRef.current);
      if (folderTreeTimeoutRef.current) clearTimeout(folderTreeTimeoutRef.current);
    };
  }, [loadingTimeout, selectedImage?.path]);

  const applyAdjustments = useCallback(debounce((currentAdjustments) => {
    if (!selectedImage?.isReady) return;
    setIsAdjusting(true);
    setError(null);
    invoke('apply_adjustments', { jsAdjustments: currentAdjustments }).catch(err => {
      console.error("Failed to invoke apply_adjustments:", err);
      setError(`Processing failed: ${err}`);
      setIsAdjusting(false);
    });
  }, 100), [selectedImage]);

  const debouncedSave = useCallback(debounce((path, adjustmentsToSave) => {
    invoke('save_metadata_and_update_thumbnail', { path, adjustments: adjustmentsToSave }).catch(err => {
        console.error("Auto-save failed:", err);
        setError(`Failed to save changes: ${err}`);
    });
  }, 500), []);

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

  useEffect(() => {
    if (adjustments.aspectRatio !== null && adjustments.crop === null && selectedImage?.width && selectedImage?.height) {
      const { width: imgWidth, height: imgHeight } = selectedImage;
      const newPercentCrop = centerAspectCrop(imgWidth, imgHeight, adjustments.aspectRatio);

      const newPixelCrop = {
        x: Math.round((newPercentCrop.x / 100) * imgWidth),
        y: Math.round((newPercentCrop.y / 100) * imgHeight),
        width: Math.round((newPercentCrop.width / 100) * imgWidth),
        height: Math.round((newPercentCrop.height / 100) * imgHeight),
      };

      setAdjustments(prev => ({
        ...prev,
        crop: newPixelCrop,
      }));
    }
  }, [adjustments.aspectRatio, adjustments.crop, selectedImage]);

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

  const handleContinueSession = () => {
    if (appSettings?.last_root_path) {
      setRootPath(appSettings.last_root_path);
      handleSelectSubfolder(appSettings.last_root_path, true);
    }
  };

  const handleGoHome = () => {
    setRootPath(null);
    setCurrentFolderPath(null);
    setImageList([]);
    setFolderTree(null);
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

        invoke('save_settings', { settings: { last_root_path: path } })
          .then(() => {
            setAppSettings(prev => ({ ...prev, last_root_path: path }));
          })
          .catch(err => console.error("Failed to save settings:", err));

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
        setUncroppedAdjustedPreviewUrl(null);
        setHistogram(null);
      }
    } catch (err)
    {
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
    setUncroppedAdjustedPreviewUrl(null);
    setAdjustments(INITIAL_ADJUSTMENTS);
    setShowOriginal(false);
    setActiveMaskId(null);
    if (transformWrapperRef.current) {
      transformWrapperRef.current.resetTransform(0);
    }
    setZoom(1);

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
        const loadedAdjustments = loadImageResult.metadata.adjustments;
        setAdjustments(prev => ({
          ...INITIAL_ADJUSTMENTS,
          ...prev,
          ...loadedAdjustments,
          hsl: { ...INITIAL_ADJUSTMENTS.hsl, ...loadedAdjustments.hsl },
          curves: { ...INITIAL_ADJUSTMENTS.curves, ...loadedAdjustments.curves },
          masks: loadedAdjustments.masks || [],
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
    setUncroppedAdjustedPreviewUrl(null);
    setHistogram(null);
    setActiveMaskId(null);
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

  const handleCopyAdjustments = () => {
    const { crop, masks, aspectRatio, ...rest } = adjustments;
    setCopiedAdjustments(rest);
  };

  const handlePasteAdjustments = () => {
    if (copiedAdjustments) {
      setAdjustments(prev => ({
        ...prev,
        ...copiedAdjustments,
      }));
    }
  };

  const handleRate = useCallback((newRating) => {
    setAdjustments(prev => ({ ...prev, rating: newRating }));
  }, []);

  const handleZoomChange = useCallback((newZoom) => {
    if (transformWrapperRef.current) {
      const { state, setTransform } = transformWrapperRef.current;
      const { positionX, positionY, scale } = state;
      const container = transformWrapperRef.current.instance.wrapperComponent;
      if (!container) return;

      const { clientWidth, clientHeight } = container;
      const centerX = clientWidth / 2;
      const centerY = clientHeight / 2;
      const newPositionX = centerX - (centerX - positionX) * (newZoom / scale);
      const newPositionY = centerY - (centerY - positionY) * (newZoom / scale);
      setTransform(newPositionX, newPositionY, newZoom, 100, 'easeOut');
    }
  }, []);

  const renderContent = () => {
    if (selectedImage) {
      return (
        <div className="flex flex-row flex-grow h-full min-h-0 gap-2">
          <FolderTree
            tree={folderTree}
            onFolderSelect={handleSelectSubfolder}
            selectedPath={currentFolderPath}
            isLoading={isTreeLoading}
            isVisible={isFolderTreeVisible}
            setIsVisible={setIsFolderTreeVisible}
          />
          <div className="flex-1 flex flex-col min-w-0 gap-2">
            <Editor
              selectedImage={selectedImage}
              quickPreviewUrl={quickPreviewUrl}
              finalPreviewUrl={finalPreviewUrl}
              uncroppedAdjustedPreviewUrl={uncroppedAdjustedPreviewUrl}
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
              renderedRightPanel={renderedRightPanel}
              adjustments={adjustments}
              setAdjustments={setAdjustments}
              thumbnails={thumbnails}
              activeMaskId={activeMaskId}
              onSelectMask={setActiveMaskId}
              transformWrapperRef={transformWrapperRef}
              onZoomed={(transformState) => setZoom(transformState.scale)}
            />
            <BottomBar
              rating={adjustments.rating || 0}
              onRate={handleRate}
              onCopy={handleCopyAdjustments}
              onPaste={handlePasteAdjustments}
              isPasteDisabled={copiedAdjustments === null}
              zoom={zoom}
              onZoomChange={handleZoomChange}
              minZoom={0.7}
              maxZoom={10}
              imageList={imageList}
              selectedImage={selectedImage}
              onImageSelect={handleImageSelect}
              thumbnails={thumbnails}
              isFilmstripVisible={isFilmstripVisible}
              setIsFilmstripVisible={setIsFilmstripVisible}
              isLoading={isViewLoading}
            />
          </div>

          <div className="flex bg-bg-secondary rounded-lg h-full">
            <div
              className={`h-full transition-all duration-300 ease-in-out ${activeRightPanel ? 'w-80' : 'w-0'} overflow-hidden`}
              onTransitionEnd={handleTransitionEnd}
            >
              <div className="w-80 h-full">
                {renderedRightPanel === 'adjustments' && (
                  <Controls
                    adjustments={adjustments}
                    setAdjustments={setAdjustments}
                    selectedImage={selectedImage}
                    histogram={histogram}
                    collapsibleState={collapsibleSectionsState}
                    setCollapsibleState={setCollapsibleSectionsState}
                  />
                )}
                {renderedRightPanel === 'metadata' && <MetadataPanel selectedImage={selectedImage} />}
                {renderedRightPanel === 'crop' && (
                  <CropPanel
                    selectedImage={selectedImage}
                    adjustments={adjustments}
                    setAdjustments={setAdjustments}
                  />
                )}
                {renderedRightPanel === 'masks' && (
                  <MasksPanel
                    adjustments={adjustments}
                    setAdjustments={setAdjustments}
                    selectedImage={selectedImage}
                    onSelectMask={setActiveMaskId}
                    activeMaskId={activeMaskId}
                  />
                )}
                {renderedRightPanel === 'presets' && (
                  <PresetsPanel
                    adjustments={adjustments}
                    setAdjustments={setAdjustments}
                    selectedImage={selectedImage}
                    activePanel={activeRightPanel}
                  />
                )}
                {renderedRightPanel === 'export' && (
                  <ExportPanel
                    selectedImage={selectedImage}
                    adjustments={adjustments}
                  />
                )}
                {renderedRightPanel === 'ai' && <AIPanel selectedImage={selectedImage} />}
              </div>
            </div>
            <div className={`h-full border-l ${activeRightPanel ? 'border-surface' : 'border-transparent'} transition-colors`}>
              <RightPanelSwitcher
                activePanel={activeRightPanel}
                onPanelSelect={handleRightPanelSelect}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
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
        appSettings={appSettings}
        onContinueSession={handleContinueSession}
        onGoHome={handleGoHome}
      />
    );
  };

  return (
    <ContextMenuProvider>
      <div className="flex flex-col h-screen bg-bg-primary font-sans text-text-primary overflow-hidden select-none">
        <TitleBar />
        <ContextMenu />

        <div className="flex-1 flex flex-col pt-12 p-2 gap-2 min-h-0">
          {error && (
            <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg z-50">
              {error}
              <button onClick={() => setError(null)} className="ml-4 font-bold hover:text-gray-200">×</button>
            </div>
          )}
          {renderContent()}
        </div>
      </div>
    </ContextMenuProvider>
  );
}

export default App;