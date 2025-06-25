import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { homeDir } from '@tauri-apps/api/path';
import debounce from 'lodash.debounce';
import { centerCrop, makeAspectCrop } from 'react-image-crop';
import clsx from 'clsx';
import { Copy, ClipboardPaste, RotateCcw, Star, Trash2, Folder, Edit, Check, X, Undo, Redo } from 'lucide-react';
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
import { ContextMenuProvider, useContextMenu } from './context/ContextMenuContext';

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

export const COPYABLE_ADJUSTMENT_KEYS = [
  'exposure', 'contrast', 'highlights', 'shadows', 'whites', 'blacks',
  'saturation', 'temperature', 'tint', 'vibrance',
  'sharpness', 'lumaNoiseReduction', 'colorNoiseReduction',
  'clarity', 'dehaze', 'structure',
  'vignetteAmount', 'vignetteMidpoint', 'vignetteRoundness', 'vignetteFeather',
  'grainAmount',
  'hsl',
  'curves',
];

const useHistoryState = (initialState) => {
  const [history, setHistory] = useState([initialState]);
  const [index, setIndex] = useState(0);

  const state = useMemo(() => history[index], [history, index]);

  const setState = useCallback((newState) => {
    const resolvedState = typeof newState === 'function' ? newState(history[index]) : newState;
    
    if (JSON.stringify(resolvedState) === JSON.stringify(history[index])) {
      return;
    }

    const newHistory = history.slice(0, index + 1);
    newHistory.push(resolvedState);
    setHistory(newHistory);
    setIndex(newHistory.length - 1);
  }, [history, index]);

  const undo = useCallback(() => {
    if (index > 0) {
      setIndex(index - 1);
    }
  }, [index]);

  const redo = useCallback(() => {
    if (index < history.length - 1) {
      setIndex(index + 1);
    }
  }, [index, history.length]);

  const resetHistory = useCallback((newInitialState) => {
    setHistory([newInitialState]);
    setIndex(0);
  }, []);

  const canUndo = index > 0;
  const canRedo = index < history.length - 1;

  return { state, setState, undo, redo, canUndo, canRedo, resetHistory };
};

const Resizer = ({ onMouseDown, direction }) => (
  <div
      onMouseDown={onMouseDown}
      className={clsx(
          'flex-shrink-0 bg-transparent z-10',
          {
              'w-2 cursor-col-resize': direction === 'vertical',
              'h-2 cursor-row-resize': direction === 'horizontal',
          }
      )}
  />
);

function App() {
  const [rootPath, setRootPath] = useState(null);
  const [appSettings, setAppSettings] = useState(null);
  const [currentFolderPath, setCurrentFolderPath] = useState(null);
  const [folderTree, setFolderTree] = useState(null);
  const [imageList, setImageList] = useState([]);
  const [imageRatings, setImageRatings] = useState({});
  const [sortCriteria, setSortCriteria] = useState({ key: 'name', order: 'asc' });
  const [selectedImage, setSelectedImage] = useState(null);
  const [multiSelectedPaths, setMultiSelectedPaths] = useState([]);
  const [libraryActivePath, setLibraryActivePath] = useState(null);
  const [libraryActiveAdjustments, setLibraryActiveAdjustments] = useState(INITIAL_ADJUSTMENTS);
  const [finalPreviewUrl, setFinalPreviewUrl] = useState(null);
  const [uncroppedAdjustedPreviewUrl, setUncroppedAdjustedPreviewUrl] = useState(null);
  
  const {
    state: historyAdjustments,
    setState: setHistoryAdjustments,
    undo: undoAdjustments,
    redo: redoAdjustments,
    canUndo,
    canRedo,
    resetHistory: resetAdjustmentsHistory,
  } = useHistoryState(INITIAL_ADJUSTMENTS);

  const [adjustments, setLiveAdjustments] = useState(INITIAL_ADJUSTMENTS);

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

  const [leftPanelWidth, setLeftPanelWidth] = useState(256);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(144);
  const [isResizing, setIsResizing] = useState(false);

  const [copiedAdjustments, setCopiedAdjustments] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isPasted, setIsPasted] = useState(false);

  const { showContextMenu } = useContextMenu();

  const imagePathList = useMemo(() => imageList.map(f => f.path), [imageList]);
  const { thumbnails } = useThumbnails(imagePathList);

  const loaderTimeoutRef = useRef(null);
  const folderTreeTimeoutRef = useRef(null);
  const transformWrapperRef = useRef(null);

  useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => setIsCopied(false), 1000);
    return () => clearTimeout(timer);
  }, [isCopied]);

  useEffect(() => {
    if (!isPasted) return;
    const timer = setTimeout(() => setIsPasted(false), 1000);
    return () => clearTimeout(timer);
  }, [isPasted]);

  const debouncedSetHistory = useCallback(debounce((newAdjustments) => {
    setHistoryAdjustments(newAdjustments);
  }, 400), [setHistoryAdjustments]);

  const setAdjustments = useCallback((value) => {
    const newAdjustments = typeof value === 'function' ? value(adjustments) : value;
    setLiveAdjustments(newAdjustments);
    debouncedSetHistory(newAdjustments);
  }, [adjustments, debouncedSetHistory]);

  useEffect(() => {
    setLiveAdjustments(historyAdjustments);
  }, [historyAdjustments]);

  const undo = useCallback(() => {
    if (canUndo) {
      undoAdjustments();
      debouncedSetHistory.cancel();
    }
  }, [canUndo, undoAdjustments, debouncedSetHistory]);

  const redo = useCallback(() => {
    if (canRedo) {
      redoAdjustments();
      debouncedSetHistory.cancel();
    }
  }, [canRedo, redoAdjustments, debouncedSetHistory]);

  const sortedImageList = useMemo(() => {
    const list = [...imageList];
    list.sort((a, b) => {
        const { key, order } = sortCriteria;
        let comparison = 0;
        switch (key) {
            case 'date':
                comparison = a.modified - b.modified; 
                break;
            case 'rating':
                const ratingA = imageRatings[a.path] || 0;
                const ratingB = imageRatings[b.path] || 0;
                comparison = ratingA - ratingB;
                break;
            case 'name':
            default:
                comparison = a.path.localeCompare(b.path);
                break;
        }
        return order === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [imageList, sortCriteria, imageRatings]);

  const createResizeHandler = useCallback((setter, startSize) => (e) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;

    const doDrag = (moveEvent) => {
        if (setter === setLeftPanelWidth) {
            const newWidth = startSize + (moveEvent.clientX - startX);
            setter(Math.max(200, Math.min(newWidth, 500)));
        } else if (setter === setRightPanelWidth) {
            const newWidth = startSize - (moveEvent.clientX - startX);
            setter(Math.max(280, Math.min(newWidth, 600)));
        } else if (setter === setBottomPanelHeight) {
            const newHeight = startSize - (moveEvent.clientY - startY);
            setter(Math.max(100, Math.min(newHeight, 400)));
        }
    };

    const stopDrag = () => {
        document.documentElement.style.cursor = '';
        window.removeEventListener('mousemove', doDrag);
        window.removeEventListener('mouseup', stopDrag);
        setIsResizing(false);
    };
    
    document.documentElement.style.cursor = setter === setBottomPanelHeight ? 'row-resize' : 'col-resize';
    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);
  }, []);

  const handleRightPanelSelect = (panelId) => {
    if (panelId === activeRightPanel) {
      setActiveRightPanel(null);
    } else {
      setActiveRightPanel(panelId);
      setRenderedRightPanel(panelId);
    }
    setActiveMaskId(null);
  };

  useEffect(() => {
    invoke('load_settings')
      .then(setAppSettings)
      .catch(err => {
        console.error("Failed to load settings:", err);
        setAppSettings({ last_root_path: null });
      });
  }, []);

  const handleSettingsChange = useCallback((newSettings) => {
    setAppSettings(newSettings);
    invoke('save_settings', { settings: newSettings })
      .catch(err => console.error("Failed to save settings:", err));
  }, []);

  const handleSelectSubfolder = useCallback(async (path, isNewRoot = false) => {
    setIsViewLoading(true);
    if (loadingTimeout) clearTimeout(loadingTimeout);

    try {
      setCurrentFolderPath(path);
      const promises = [invoke('list_images_in_dir', { path })];

      if (isNewRoot) {
        setIsTreeLoading(true);
        setFolderTree(null);

        handleSettingsChange({ ...appSettings, last_root_path: path });

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
      setImageRatings({});
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
  }, [appSettings, handleSettingsChange, loadingTimeout, selectedImage]);

  const handleLibraryRefresh = useCallback(() => {
    if (currentFolderPath) {
      handleSelectSubfolder(currentFolderPath, false);
    }
  }, [currentFolderPath, handleSelectSubfolder]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isInputFocused = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA';

      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === 'a' && !isInputFocused) {
          event.preventDefault();
          if (sortedImageList.length > 0) {
            setMultiSelectedPaths(sortedImageList.map(f => f.path));
            if (!selectedImage) {
              setLibraryActivePath(sortedImageList[sortedImageList.length - 1].path);
            }
          }
        } else if (key === 'z' && !isInputFocused && selectedImage) {
          event.preventDefault();
          undo();
        } else if (key === 'y' && !isInputFocused && selectedImage) {
          event.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sortedImageList, selectedImage, undo, redo]);

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
      listen('thumbnail-generated', (event) => {
        if (isEffectActive) {
          const { path, rating } = event.payload;
          if (rating !== undefined) {
            setImageRatings(prev => ({ ...prev, [path]: rating }));
          }
        }
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
  }, [loadingTimeout]);

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
  }, 50), [selectedImage?.isReady]);

  const debouncedGenerateUncroppedPreview = useCallback(debounce((currentAdjustments) => {
    if (!selectedImage?.isReady) return;
    invoke('generate_uncropped_preview', { jsAdjustments: currentAdjustments }).catch(err => {
      console.error("Failed to generate uncropped preview:", err);
    });
  }, 100), [selectedImage?.isReady]);

  const debouncedSave = useCallback(debounce((path, adjustmentsToSave) => {
    invoke('save_metadata_and_update_thumbnail', { path, adjustments: adjustmentsToSave }).catch(err => {
        console.error("Auto-save failed:", err);
        setError(`Failed to save changes: ${err}`);
    });
  }, 300), []);

  useEffect(() => {
    if (selectedImage?.isReady) {
      applyAdjustments(adjustments);
      debouncedSave(selectedImage.path, adjustments);
    }
    return () => {
      applyAdjustments.cancel();
      debouncedSave.cancel();
    }
  }, [adjustments, selectedImage?.path, selectedImage?.isReady, applyAdjustments, debouncedSave]);

  useEffect(() => {
    if (activeRightPanel === 'crop' && selectedImage?.isReady) {
      debouncedGenerateUncroppedPreview(adjustments);
    }
    return () => {
      debouncedGenerateUncroppedPreview.cancel();
    }
  }, [adjustments, activeRightPanel, selectedImage?.isReady, debouncedGenerateUncroppedPreview]);

  useEffect(() => {
    if (adjustments.aspectRatio !== null && adjustments.crop === null && selectedImage?.width && selectedImage?.height) {
      const { width: imgWidth, height: imgHeight } = selectedImage;
      const newPercentCrop = centerCrop(makeAspectCrop({ unit: '%', width: 100 }, adjustments.aspectRatio, imgWidth, imgHeight), imgWidth, imgHeight);

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
  }, [adjustments.aspectRatio, adjustments.crop, selectedImage?.width, selectedImage?.height, setAdjustments]);

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
    setImageRatings({});
    setFolderTree(null);
    setMultiSelectedPaths([]);
    setLibraryActivePath(null);
    setIsLibraryExportPanelVisible(false);
  };

  const handleMultiSelectClick = (path, event, options) => {
    const { ctrlKey, metaKey, shiftKey } = event;
    const isCtrlPressed = ctrlKey || metaKey;
    const { shiftAnchor, onSimpleClick, updateLibraryActivePath } = options;

    if (shiftKey && shiftAnchor) {
      const lastIndex = sortedImageList.findIndex(f => f.path === shiftAnchor);
      const currentIndex = sortedImageList.findIndex(f => f.path === path);
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const range = sortedImageList.slice(start, end + 1).map(f => f.path);

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

  const handleImageSelect = (path) => {
    if (selectedImage?.path === path) return;

    applyAdjustments.cancel();
    debouncedSave.cancel();

    const thumbnail = thumbnails[path];

    setSelectedImage({
      path,
      thumbnailUrl: thumbnail,
      isReady: false,
      originalUrl: null,
      width: 0,
      height: 0,
      metadata: null,
      exif: null,
      isRaw: false,
    });
    setMultiSelectedPaths([path]);
    setLibraryActivePath(null);
    setIsViewLoading(true);
    setError(null);
    setHistogram(null);
    setFinalPreviewUrl(null);
    setUncroppedAdjustedPreviewUrl(null);
    
    setLiveAdjustments(INITIAL_ADJUSTMENTS);
    resetAdjustmentsHistory(INITIAL_ADJUSTMENTS);

    setShowOriginal(false);
    setActiveMaskId(null);
    if (transformWrapperRef.current) {
      transformWrapperRef.current.resetTransform(0);
    }
    setZoom(1);
    setIsLibraryExportPanelVisible(false);
  };

  useEffect(() => {
    if (selectedImage && !selectedImage.isReady && selectedImage.path) {
      let isEffectActive = true;

      const loadFullImageData = async () => {
        try {
          const loadImageResult = await invoke('load_image', { path: selectedImage.path });
          if (!isEffectActive) return;

          const histData = await invoke('generate_histogram');
          if (!isEffectActive) return;

          setSelectedImage(currentSelected => {
            if (currentSelected && currentSelected.path === selectedImage.path) {
              return {
                ...currentSelected,
                originalUrl: loadImageResult.original_base64,
                width: loadImageResult.width,
                height: loadImageResult.height,
                metadata: loadImageResult.metadata,
                exif: loadImageResult.exif,
                isRaw: loadImageResult.is_raw,
                isReady: true,
              };
            }
            return currentSelected;
          });

          let initialAdjusts = INITIAL_ADJUSTMENTS;
          if (loadImageResult.metadata.adjustments && !loadImageResult.metadata.adjustments.is_null) {
            const loadedAdjustments = loadImageResult.metadata.adjustments;
            initialAdjusts = {
              ...INITIAL_ADJUSTMENTS,
              ...loadedAdjustments,
              hsl: { ...INITIAL_ADJUSTMENTS.hsl, ...loadedAdjustments.hsl },
              curves: { ...INITIAL_ADJUSTMENTS.curves, ...loadedAdjustments.curves },
              masks: loadedAdjustments.masks || [],
            };
          }
          setLiveAdjustments(initialAdjusts);
          resetAdjustmentsHistory(initialAdjusts);
          
          setHistogram(histData);

        } catch (err) {
          if (isEffectActive) {
            console.error("Failed to load image:", err);
            setError(`Failed to load image: ${err}`);
            setSelectedImage(null);
          }
        } finally {
          if (isEffectActive) {
            setIsViewLoading(false);
          }
        }
      };

      loadFullImageData();

      return () => {
        isEffectActive = false;
      };
    }
  }, [selectedImage?.path, selectedImage?.isReady, resetAdjustmentsHistory]);

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

  const handleCopyAdjustments = useCallback(() => {
    const sourceAdjustments = selectedImage ? adjustments : libraryActiveAdjustments;
    
    const adjustmentsToCopy = {};
    for (const key of COPYABLE_ADJUSTMENT_KEYS) {
      if (sourceAdjustments.hasOwnProperty(key)) {
        adjustmentsToCopy[key] = sourceAdjustments[key];
      }
    }

    setCopiedAdjustments(adjustmentsToCopy);
    setIsCopied(true);
  }, [selectedImage, adjustments, libraryActiveAdjustments]);

  const handlePasteAdjustments = useCallback(() => {
    if (!copiedAdjustments) return;

    const pathsToUpdate = multiSelectedPaths.length > 0 
      ? multiSelectedPaths 
      : (selectedImage ? [selectedImage.path] : []);

    if (pathsToUpdate.length === 0) return;

    if (selectedImage && pathsToUpdate.includes(selectedImage.path)) {
      setAdjustments(prev => ({
        ...prev,
        ...copiedAdjustments,
      }));
    }

    invoke('apply_adjustments_to_paths', { paths: pathsToUpdate, adjustments: copiedAdjustments })
      .catch(err => {
        console.error("Failed to paste adjustments to multiple images:", err);
        setError(`Failed to paste adjustments: ${err}`);
      });
    
    setIsPasted(true);
  }, [copiedAdjustments, multiSelectedPaths, selectedImage, setAdjustments]);

  const handleRate = useCallback((newRating) => {
    const pathsToRate = multiSelectedPaths.length > 0 
      ? multiSelectedPaths 
      : (selectedImage ? [selectedImage.path] : []);

    if (pathsToRate.length === 0) {
      return;
    }

    setImageRatings(prev => {
      const newRatings = { ...prev };
      pathsToRate.forEach(path => {
        newRatings[path] = newRating;
      });
      return newRatings;
    });

    if (selectedImage && pathsToRate.includes(selectedImage.path)) {
      setAdjustments(prev => ({ ...prev, rating: newRating }));
    }

    if (libraryActivePath && pathsToRate.includes(libraryActivePath)) {
      setLibraryActiveAdjustments(prev => ({ ...prev, rating: newRating }));
    }

    invoke('apply_adjustments_to_paths', { paths: pathsToRate, adjustments: { rating: newRating } })
      .catch(err => {
        console.error("Failed to apply rating to paths:", err);
        setError(`Failed to apply rating: ${err}`);
      });

  }, [multiSelectedPaths, selectedImage, libraryActivePath, setAdjustments]);

const handleZoomChange = useCallback((newZoomValue) => {
  setZoom(newZoomValue);

  if (transformWrapperRef.current) {
    const wrapperInstance = transformWrapperRef.current;
    const { setTransform, state: currentTransformState, instance: rzpInstance } = wrapperInstance;

    if (typeof setTransform !== 'function') {
      console.error("setTransform is not a function on transformWrapperRef.current");
      return;
    }

    const container = rzpInstance?.wrapperComponent;

    if (container && container.clientWidth > 0 && container.clientHeight > 0 && currentTransformState) {
      const { clientWidth: viewportWidth, clientHeight: viewportHeight } = container;
      const { scale: currentScale, positionX: currentPanX, positionY: currentPanY } = currentTransformState;

      if (currentScale === 0 || currentScale === newZoomValue) {
        setTransform(currentPanX, currentPanY, newZoomValue, 100, 'easeOut');
        return;
      }

      const viewportCenterX = viewportWidth / 2;
      const viewportCenterY = viewportHeight / 2;
      const scaleRatio = newZoomValue / currentScale;
      const newPanX = viewportCenterX - (viewportCenterX - currentPanX) * scaleRatio;
      const newPanY = viewportCenterY - (viewportCenterY - currentPanY) * scaleRatio;
      
      setTransform(newPanX, newPanY, newZoomValue, 100, 'easeOut');

    } else {
      const fallbackX = currentTransformState ? currentTransformState.positionX : null;
      const fallbackY = currentTransformState ? currentTransformState.positionY : null;
      setTransform(fallbackX, fallbackY, newZoomValue, 100, 'easeOut');
    }
  }
}, [setZoom]);

  const handleClearSelection = () => {
    if (selectedImage) {
      setMultiSelectedPaths([selectedImage.path]);
    } else {
      setMultiSelectedPaths([]);
      setLibraryActivePath(null);
    }
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

  const handleEditorContextMenu = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const options = [
      { label: 'Undo', icon: Undo, onClick: undo, disabled: !canUndo },
      { label: 'Redo', icon: Redo, onClick: redo, disabled: !canRedo },
      { type: 'separator' },
      { label: 'Copy Adjustments', icon: Copy, onClick: handleCopyAdjustments },
      { label: 'Paste Adjustments', icon: ClipboardPaste, onClick: handlePasteAdjustments, disabled: copiedAdjustments === null },
      { type: 'separator' },
      {
        label: 'Set Rating',
        icon: Star,
        submenu: [0, 1, 2, 3, 4, 5].map(rating => ({
          label: `${rating} Star${rating !== 1 ? 's' : ''}`,
          onClick: () => handleRate(rating),
        }))
      },
      { type: 'separator' },
      {
        label: 'Reset Adjustments',
        icon: RotateCcw,
        onClick: () => setAdjustments(prev => ({ ...INITIAL_ADJUSTMENTS, rating: prev.rating })),
      },
    ];

    showContextMenu(event.clientX, event.clientY, options);
  };

  const handleThumbnailContextMenu = (event, path) => {
    event.preventDefault();
    event.stopPropagation();

    const isTargetInSelection = multiSelectedPaths.includes(path);
    let finalSelection = [];

    if (!isTargetInSelection) {
      finalSelection = [path];
      setMultiSelectedPaths([path]);
      if (!selectedImage) {
        setLibraryActivePath(path);
      }
    } else {
      finalSelection = multiSelectedPaths;
    }

    const selectionCount = finalSelection.length;
    const isSingleSelection = selectionCount === 1;
    
    const isEditingThisImage = selectedImage?.path === path;

    const pasteLabel = isSingleSelection
        ? 'Paste Adjustments'
        : `Paste Adjustments to ${selectionCount} Images`;
    const resetLabel = isSingleSelection
        ? 'Reset Adjustments'
        : `Reset Adjustments on ${selectionCount} Images`;
    const deleteLabel = isSingleSelection
        ? 'Delete Image'
        : `Delete ${selectionCount} Images`;

    const options = [
      ...(!isEditingThisImage ? [
        {
          label: 'Edit Photo',
          icon: Edit,
          disabled: !isSingleSelection,
          onClick: () => handleImageSelect(finalSelection[0]),
        },
        { type: 'separator' },
      ] : []),
      
      {
        label: 'Copy Adjustments',
        icon: Copy,
        disabled: !isSingleSelection,
        onClick: async () => {
          try {
            const sourcePath = finalSelection[0];
            const metadata = await invoke('load_metadata', { path: sourcePath });
            
            const sourceAdjustments = (metadata.adjustments && !metadata.adjustments.is_null)
              ? { ...INITIAL_ADJUSTMENTS, ...metadata.adjustments }
              : INITIAL_ADJUSTMENTS;

            const adjustmentsToCopy = {};
            for (const key of COPYABLE_ADJUSTMENT_KEYS) {
              if (sourceAdjustments.hasOwnProperty(key)) {
                adjustmentsToCopy[key] = sourceAdjustments[key];
              }
            }
            
            setCopiedAdjustments(adjustmentsToCopy);
            setIsCopied(true);

          } catch (err) {
            console.error("Failed to load metadata for copy:", err);
            setError(`Failed to copy adjustments: ${err}`);
          }
        },
      },
      {
        label: pasteLabel,
        icon: ClipboardPaste,
        disabled: copiedAdjustments === null,
        onClick: handlePasteAdjustments,
      },
      { type: 'separator' },
      {
        label: 'Set Rating',
        icon: Star,
        submenu: [0, 1, 2, 3, 4, 5].map(rating => ({
          label: `${rating} Star${rating !== 1 ? 's' : ''}`,
          onClick: () => handleRate(rating),
        }))
      },
      { type: 'separator' },
      {
        label: 'Show in File Explorer',
        icon: Folder,
        disabled: !isSingleSelection,
        onClick: () => {
          invoke('show_in_finder', { path: finalSelection[0] })
            .catch(err => setError(`Could not show file in explorer: ${err}`));
        }
      },
      {
        label: resetLabel,
        icon: RotateCcw,
        onClick: () => {
          if (finalSelection.length === 0) return;
          invoke('reset_adjustments_for_paths', { paths: finalSelection })
            .then(() => {
              if (finalSelection.includes(libraryActivePath)) {
                setLibraryActiveAdjustments(prev => ({ ...INITIAL_ADJUSTMENTS, rating: prev.rating }));
              }
              if (selectedImage && finalSelection.includes(selectedImage.path)) {
                  setAdjustments(prev => ({ ...INITIAL_ADJUSTMENTS, rating: prev.rating }));
              }
            })
            .catch(err => {
              console.error("Failed to reset adjustments:", err);
              setError(`Failed to reset adjustments: ${err}`);
            });
        },
      },
      {
        label: deleteLabel,
        icon: Trash2,
        isDestructive: true,
        submenu: [
          {
            label: 'Cancel',
            icon: X,
            onClick: () => {},
          },
          {
            label: `Delete ${isSingleSelection ? '' : `${selectionCount} Images`}`,
            icon: Check,
            isDestructive: true,
            onClick: async () => {
              try {
                await invoke('delete_files_from_disk', { paths: finalSelection });
                handleLibraryRefresh();
              } catch (err) {
                console.error("Failed to delete files:", err);
                setError(`Failed to delete files: ${err}`);
              }
            },
          },
        ],
      },
    ];

    showContextMenu(event.clientX, event.clientY, options);
  };

  const renderContent = () => {
    if (selectedImage) {
      return (
        <div className="flex flex-row flex-grow h-full min-h-0">
          <FolderTree
            tree={folderTree}
            onFolderSelect={handleSelectSubfolder}
            selectedPath={currentFolderPath}
            isLoading={isTreeLoading}
            isVisible={isFolderTreeVisible}
            setIsVisible={setIsFolderTreeVisible}
            style={{ width: isFolderTreeVisible ? `${leftPanelWidth}px` : '32px' }}
            isResizing={isResizing}
          />
          <Resizer onMouseDown={createResizeHandler(setLeftPanelWidth, leftPanelWidth)} direction="vertical" />

          <div className="flex-1 flex flex-col min-w-0">
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
              onContextMenu={handleEditorContextMenu}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
            <Resizer onMouseDown={createResizeHandler(setBottomPanelHeight, bottomPanelHeight)} direction="horizontal" />
            <BottomBar
              rating={adjustments.rating || 0}
              onRate={handleRate}
              onCopy={handleCopyAdjustments}
              onPaste={handlePasteAdjustments}
              isCopied={isCopied}
              isPasted={isPasted}
              isPasteDisabled={copiedAdjustments === null}
              zoom={zoom}
              onZoomChange={handleZoomChange}
              minZoom={0.7}
              maxZoom={10}
              imageList={sortedImageList}
              selectedImage={selectedImage}
              onImageSelect={handleImageClick}
              onContextMenu={handleThumbnailContextMenu}
              multiSelectedPaths={multiSelectedPaths}
              thumbnails={thumbnails}
              imageRatings={imageRatings}
              isFilmstripVisible={isFilmstripVisible}
              setIsFilmstripVisible={setIsFilmstripVisible}
              isLoading={isViewLoading}
              onClearSelection={handleClearSelection}
              filmstripHeight={bottomPanelHeight}
              isResizing={isResizing}
            />
          </div>

          <Resizer onMouseDown={createResizeHandler(setRightPanelWidth, rightPanelWidth)} direction="vertical" />
          <div className="flex bg-bg-secondary rounded-lg h-full">
            <div
              className={clsx(
                'h-full overflow-hidden',
                !isResizing && 'transition-all duration-300 ease-in-out'
              )}
              style={{ width: activeRightPanel ? `${rightPanelWidth}px` : '0px' }}
            >
              <div style={{ width: `${rightPanelWidth}px` }} className="h-full">
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
            <div className={clsx('h-full border-l transition-colors', activeRightPanel ? 'border-surface' : 'border-transparent')}>
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
      <div className="flex flex-row flex-grow h-full min-h-0">
        {rootPath && (
          <>
            <FolderTree
              tree={folderTree}
              onFolderSelect={handleSelectSubfolder}
              selectedPath={currentFolderPath}
              isLoading={isTreeLoading}
              isVisible={isFolderTreeVisible}
              setIsVisible={setIsFolderTreeVisible}
              style={{ width: isFolderTreeVisible ? `${leftPanelWidth}px` : '32px' }}
              isResizing={isResizing}
            />
            <Resizer onMouseDown={createResizeHandler(setLeftPanelWidth, leftPanelWidth)} direction="vertical" />
          </>
        )}
        <div className="flex-1 flex flex-col min-w-0 gap-2">
          <MainLibrary
            imageList={sortedImageList}
            onImageClick={handleLibraryImageSingleClick}
            onImageDoubleClick={handleImageSelect}
            onContextMenu={handleThumbnailContextMenu}
            multiSelectedPaths={multiSelectedPaths}
            activePath={libraryActivePath}
            rootPath={rootPath}
            currentFolderPath={currentFolderPath}
            onOpenFolder={handleOpenFolder}
            isTreeLoading={isTreeLoading}
            isLoading={isViewLoading}
            thumbnails={thumbnails}
            imageRatings={imageRatings}
            appSettings={appSettings}
            onContinueSession={handleContinueSession}
            onGoHome={handleGoHome}
            onClearSelection={handleClearSelection}
            sortCriteria={sortCriteria}
            setSortCriteria={setSortCriteria}
            onSettingsChange={handleSettingsChange}
            onLibraryRefresh={handleLibraryRefresh}
          />
          {rootPath && <BottomBar
            isLibraryView={true}
            rating={libraryActiveAdjustments.rating || 0}
            onRate={handleRate}
            onCopy={handleCopyAdjustments}
            onPaste={handlePasteAdjustments}
            isCopied={isCopied}
            isPasted={isPasted}
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
    <div className="flex flex-col h-screen bg-bg-primary font-sans text-text-primary overflow-hidden select-none">
      <TitleBar />

      <div className="flex-1 flex flex-col pt-12 p-2 gap-2 min-h-0">
        {error && (
          <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg z-50">
            {error}
            <button onClick={() => setError(null)} className="ml-4 font-bold hover:text-gray-200">×</button>
          </div>
        )}

        <div className="flex flex-row flex-grow h-full min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
            {renderContent()}
          </div>
          
          <div className={clsx(
            'flex-shrink-0 overflow-hidden',
            !isResizing && 'transition-all duration-300 ease-in-out',
            isLibraryExportPanelVisible ? 'w-80 ml-2' : 'w-0'
          )}>
            <LibraryExportPanel
              isVisible={isLibraryExportPanelVisible}
              onClose={() => setIsLibraryExportPanelVisible(false)}
              multiSelectedPaths={multiSelectedPaths}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrap the App in the provider
const AppWrapper = () => (
  <ContextMenuProvider>
    <App />
  </ContextMenuProvider>
);

export default AppWrapper;