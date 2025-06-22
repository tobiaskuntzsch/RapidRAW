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
import LibraryExportPanel from './components/panel/right/LibraryExportPanel';
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
  // Basic
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  saturation: 0, temperature: 0, tint: 0, vibrance: 0,
  // Details
  sharpness: 0,
  lumaNoiseReduction: 0,
  colorNoiseReduction: 0,
  // Effects
  clarity: 0,
  dehaze: 0,
  structure: 0,
  vignetteAmount: 0,
  vignetteMidpoint: 50,
  vignetteRoundness: 0,
  vignetteFeather: 50,
  grainAmount: 0,
  // HSL
  hsl: {
    reds: { hue: 0, saturation: 0, luminance: 0 }, oranges: { hue: 0, saturation: 0, luminance: 0 },
    yellows: { hue: 0, saturation: 0, luminance: 0 }, greens: { hue: 0, saturation: 0, luminance: 0 },
    aquas: { hue: 0, saturation: 0, luminance: 0 }, blues: { hue: 0, saturation: 0, luminance: 0 },
    purples: { hue: 0, saturation: 0, luminance: 0 }, magentas: { hue: 0, saturation: 0, luminance: 0 },
  },
  // Curves
  curves: {
    luma: [{ x: 0, y: 0 }, { x: 255, y: 255 }], red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    green: [{ x: 0, y: 0 }, { x: 255, y: 255 }], blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  },
  // Other
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
  const [multiSelectedPaths, setMultiSelectedPaths] = useState([]);
  const [libraryActivePath, setLibraryActivePath] = useState(null);
  const [libraryActiveAdjustments, setLibraryActiveAdjustments] = useState(INITIAL_ADJUSTMENTS);
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
    details: false,
    effects: false,
  });

  const [isLibraryExportPanelVisible, setIsLibraryExportPanelVisible] = useState(false);

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
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
          return;
        }
        
        event.preventDefault();

        if (imageList.length > 0) {
          setMultiSelectedPaths(imageList);
          if (!selectedImage) {
            setLibraryActivePath(imageList[imageList.length - 1]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [imageList, selectedImage]);

  useEffect(() => {
    let isEffectActive = true;

    const listeners = [
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

  useEffect(() => {
    if (libraryActivePath) {
      invoke('load_metadata', { path: libraryActivePath })
        .then(metadata => {
          if (metadata.adjustments && !metadata.adjustments.is_null) {
            const loadedAdjustments = metadata.adjustments;
            setLibraryActiveAdjustments({
              ...INITIAL_ADJUSTMENTS,
              ...loadedAdjustments,
              hsl: { ...INITIAL_ADJUSTMENTS.hsl, ...loadedAdjustments.hsl },
              curves: { ...INITIAL_ADJUSTMENTS.curves, ...loadedAdjustments.curves },
              masks: loadedAdjustments.masks || [],
            });
          } else {
            setLibraryActiveAdjustments(INITIAL_ADJUSTMENTS);
          }
        })
        .catch(err => {
          console.error("Failed to load metadata for library active image", err);
          setLibraryActiveAdjustments(INITIAL_ADJUSTMENTS);
        });
    } else {
      setLibraryActiveAdjustments(INITIAL_ADJUSTMENTS);
    }
  }, [libraryActivePath]);

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

  const debouncedGenerateUncroppedPreview = useCallback(debounce((currentAdjustments) => {
    if (!selectedImage?.isReady) return;
    invoke('generate_uncropped_preview', { jsAdjustments: currentAdjustments }).catch(err => {
      console.error("Failed to generate uncropped preview:", err);
    });
  }, 150), [selectedImage]);

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
    if (activeRightPanel === 'crop' && selectedImage?.isReady) {
      debouncedGenerateUncroppedPreview(adjustments);
    }
    return () => {
      debouncedGenerateUncroppedPreview.cancel();
    }
  }, [adjustments, activeRightPanel, selectedImage, debouncedGenerateUncroppedPreview]);

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
    setMultiSelectedPaths([]);
    setLibraryActivePath(null);
    setIsLibraryExportPanelVisible(false);
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
      setMultiSelectedPaths([]);
      setLibraryActivePath(null);

      if (selectedImage) {
        setSelectedImage(null);
        setFinalPreviewUrl(null);
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

  const handleMultiSelectClick = (path, event, options) => {
    const { ctrlKey, metaKey, shiftKey } = event;
    const isCtrlPressed = ctrlKey || metaKey;
    const { shiftAnchor, onSimpleClick, updateLibraryActivePath } = options;

    if (shiftKey && shiftAnchor) {
      const lastIndex = imageList.indexOf(shiftAnchor);
      const currentIndex = imageList.indexOf(path);
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const range = imageList.slice(start, end + 1);

        const baseSelection = isCtrlPressed ? multiSelectedPaths : [shiftAnchor];
        const newSelection = Array.from(new Set([...baseSelection, ...range]));
        setMultiSelectedPaths(newSelection);

        if (updateLibraryActivePath) {
          setLibraryActivePath(path);
        }
      }
    } else if (isCtrlPressed) {
      const newSelection = new Set(multiSelectedPaths);
      if (newSelection.has(path)) {
        newSelection.delete(path);
      } else {
        newSelection.add(path);
      }
      const newSelectionArray = Array.from(newSelection);
      setMultiSelectedPaths(newSelectionArray);

      if (updateLibraryActivePath) {
        if (newSelectionArray.includes(path)) {
          setLibraryActivePath(path);
        } else if (newSelectionArray.length > 0) {
          setLibraryActivePath(newSelectionArray[newSelectionArray.length - 1]);
        } else {
          setLibraryActivePath(null);
        }
      }
    } else {
      onSimpleClick(path);
    }
  };

  const handleLibraryImageSingleClick = (path, event) => {
    handleMultiSelectClick(path, event, {
      shiftAnchor: libraryActivePath,
      updateLibraryActivePath: true,
      onSimpleClick: (p) => {
        setMultiSelectedPaths([p]);
        setLibraryActivePath(p);
      },
    });
  };

  const handleImageClick = (path, event) => {
    const inEditor = !!selectedImage;
    handleMultiSelectClick(path, event, {
      shiftAnchor: inEditor ? selectedImage.path : libraryActivePath,
      updateLibraryActivePath: !inEditor,
      onSimpleClick: handleImageSelect,
    });
  };

  const handleImageSelect = async (path) => {
    if (selectedImage?.path === path) return;

    applyAdjustments.cancel();
    debouncedSave.cancel();

    setSelectedImage({ path, originalUrl: null, isReady: false, width: 0, height: 0, metadata: null, exif: null, isRaw: false });
    setMultiSelectedPaths([path]);
    setLibraryActivePath(null);
    setIsViewLoading(true);
    setError(null);
    setHistogram(null);
    setFinalPreviewUrl(null);
    setUncroppedAdjustedPreviewUrl(null);
    setAdjustments(INITIAL_ADJUSTMENTS);
    setShowOriginal(false);
    setActiveMaskId(null);
    if (transformWrapperRef.current) {
      transformWrapperRef.current.resetTransform(0);
    }
    setZoom(1);
    setIsLibraryExportPanelVisible(false);

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
            exif: loadImageResult.exif,
            isRaw: loadImageResult.is_raw,
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
    const lastActivePath = selectedImage?.path;
    setSelectedImage(null);
    setFinalPreviewUrl(null);
    setUncroppedAdjustedPreviewUrl(null);
    setHistogram(null);
    setActiveMaskId(null);
    setLibraryActivePath(lastActivePath);
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
    const sourceAdjustments = selectedImage ? adjustments : libraryActiveAdjustments;
    const { crop, masks, aspectRatio, ...rest } = sourceAdjustments;
    setCopiedAdjustments(rest);
  };

  const handlePasteAdjustments = () => {
    if (!copiedAdjustments) return;

    const adjustmentsToPaste = { ...copiedAdjustments };

    if (selectedImage && multiSelectedPaths.length <= 1) {
      setAdjustments(prev => ({
        ...prev,
        ...adjustmentsToPaste,
      }));
    }

    const pathsToUpdate = multiSelectedPaths.length > 0 ? multiSelectedPaths : (selectedImage ? [selectedImage.path] : []);

    if (pathsToUpdate.length > 0) {
      invoke('apply_adjustments_to_paths', { paths: pathsToUpdate, adjustments: adjustmentsToPaste })
        .catch(err => {
          console.error("Failed to paste adjustments to multiple images:", err);
          setError(`Failed to paste adjustments: ${err}`);
        });
    }
  };

  const handleRate = useCallback((newRating) => {
    if (selectedImage) {
      setAdjustments(prev => ({ ...prev, rating: newRating }));
    } else if (libraryActivePath) {
      const newAdjustments = { ...libraryActiveAdjustments, rating: newRating };
      setLibraryActiveAdjustments(newAdjustments);
      invoke('save_metadata_and_update_thumbnail', { path: libraryActivePath, adjustments: newAdjustments });
    }
  }, [selectedImage, libraryActivePath, libraryActiveAdjustments]);

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

  const handleClearSelection = () => {
    setMultiSelectedPaths([]);
    setLibraryActivePath(null);
  };

  const handleResetAdjustments = () => {
    if (multiSelectedPaths.length === 0) return;

    invoke('reset_adjustments_for_paths', { paths: multiSelectedPaths })
      .then(() => {
        if (multiSelectedPaths.includes(libraryActivePath)) {
          setLibraryActiveAdjustments(prev => ({
              ...INITIAL_ADJUSTMENTS,
              rating: prev.rating
          }));
        }
      })
      .catch(err => {
        console.error("Failed to reset adjustments:", err);
        setError(`Failed to reset adjustments: ${err}`);
      });
  };

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
              onImageSelect={handleImageClick}
              multiSelectedPaths={multiSelectedPaths}
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
                    multiSelectedPaths={multiSelectedPaths}
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
      <div className="flex flex-row flex-grow h-full min-h-0 gap-2">
        {rootPath && (
          <FolderTree
            tree={folderTree}
            onFolderSelect={handleSelectSubfolder}
            selectedPath={currentFolderPath}
            isLoading={isTreeLoading}
            isVisible={isFolderTreeVisible}
            setIsVisible={setIsFolderTreeVisible}
          />
        )}
        <div className="flex-1 flex flex-col min-w-0 gap-2">
          <MainLibrary
            imageList={imageList}
            onImageClick={handleLibraryImageSingleClick}
            onImageDoubleClick={handleImageSelect}
            multiSelectedPaths={multiSelectedPaths}
            activePath={libraryActivePath}
            rootPath={rootPath}
            currentFolderPath={currentFolderPath}
            onOpenFolder={handleOpenFolder}
            isTreeLoading={isTreeLoading}
            isLoading={isViewLoading}
            thumbnails={thumbnails}
            appSettings={appSettings}
            onContinueSession={handleContinueSession}
            onGoHome={handleGoHome}
            onClearSelection={handleClearSelection}
          />
          {rootPath && <BottomBar
            isLibraryView={true}
            rating={libraryActiveAdjustments.rating || 0}
            onRate={handleRate}
            onCopy={handleCopyAdjustments}
            onPaste={handlePasteAdjustments}
            isPasteDisabled={copiedAdjustments === null || multiSelectedPaths.length === 0}
            onReset={handleResetAdjustments}
            isResetDisabled={multiSelectedPaths.length === 0}
            onExportClick={() => setIsLibraryExportPanelVisible(prev => !prev)}
            isExportDisabled={multiSelectedPaths.length === 0}
          />}
        </div>
      </div>
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

          <div className="flex flex-row flex-grow h-full min-h-0">
            <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
              {renderContent()}
            </div>
            
            <div className={`
              flex-shrink-0 
              transition-all duration-300 ease-in-out 
              overflow-hidden
              ${isLibraryExportPanelVisible ? 'w-80 ml-2' : 'w-0'}
            `}>
              <LibraryExportPanel
                isVisible={isLibraryExportPanelVisible}
                onClose={() => setIsLibraryExportPanelVisible(false)}
                multiSelectedPaths={multiSelectedPaths}
              />
            </div>
          </div>
        </div>
      </div>
    </ContextMenuProvider>
  );
}

export default App;