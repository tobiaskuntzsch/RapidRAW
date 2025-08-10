import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { homeDir } from '@tauri-apps/api/path';
import { getCurrentWindow } from '@tauri-apps/api/window';
import debounce from 'lodash.debounce';
import clsx from 'clsx';
import {
  Aperture,
  Check,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Edit,
  FileEdit,
  Folder,
  FolderInput,
  FolderPlus,
  Images,
  Redo,
  RotateCcw,
  Star,
  Tag,
  Trash2,
  Undo,
  X,
} from 'lucide-react';
import TitleBar from './window/TitleBar';
import MainLibrary from './components/panel/MainLibrary';
import FolderTree from './components/panel/FolderTree';
import Editor from './components/panel/Editor';
import Controls from './components/panel/right/ControlsPanel';
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
import CreateFolderModal from './components/modals/CreateFolderModal';
import RenameFolderModal from './components/modals/RenameFolderModal';
import ConfirmModal from './components/modals/ConfirmModal';
import ImportSettingsModal from './components/modals/ImportSettingsModal';
import RenameFileModal from './components/modals/RenameFileModal';
import PanoramaModal from './components/modals/PanoramaModal';
import { useHistoryState } from './hooks/useHistoryState';
import Resizer from './components/ui/Resizer';
import {
  Adjustments,
  AiPatch,
  Color,
  COLOR_LABELS,
  Coord,
  COPYABLE_ADJUSTMENT_KEYS,
  INITIAL_ADJUSTMENTS,
  MaskContainer,
  normalizeLoadedAdjustments,
} from './utils/adjustments';
import { generatePaletteFromImage } from './utils/palette';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { THEMES, DEFAULT_THEME_ID, ThemeProps } from './utils/themes';
import { SubMask, ToolType } from './components/panel/right/Masks';
import {
  EXPORT_TIMEOUT,
  ExportState,
  IMPORT_TIMEOUT,
  ImportState,
  Status,
} from './components/panel/right/ExportImportProperties';
import {
  AppSettings,
  BrushSettings,
  FilterCriteria,
  Invokes,
  ImageFile,
  Option,
  OPTION_SEPARATOR,
  Panel,
  Progress,
  RawStatus,
  SelectedImage,
  SortCriteria,
  SortDirection,
  SupportedTypes,
  Theme,
  TransformState,
  UiVisibility,
  WaveformData,
  Orientation,
  ThumbnailSize,
  ThumbnailAspectRatio,
} from './components/ui/AppProperties';
import { ChannelConfig } from './components/adjustments/Curves';

interface CollapsibleSectionsState {
  basic: boolean;
  color: boolean;
  curves: boolean;
  details: boolean;
  effects: boolean;
}

interface ConfirmModalState {
  confirmText?: string;
  confirmVariant?: string;
  isOpen: boolean;
  message?: string;
  onConfirm?(): void;
  title?: string;
}

interface Metadata {
  adjustments: Adjustments;
  rating: number;
  tags: Array<string> | null;
  version: number;
}

interface MultiSelectOptions {
  onSimpleClick(p: any): void;
  updateLibraryActivePath: boolean;
  shiftAnchor: string | null;
}

interface PanoramaModalState {
  error: string | null;
  finalImageBase64: string | null;
  isOpen: boolean;
  progressMessage: string | null;
  stitchingSourcePaths: Array<string>;
}

const DEBUG = false;

function App() {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [isWindowFullScreen, setIsWindowFullScreen] = useState(false);
  const [currentFolderPath, setCurrentFolderPath] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [folderTree, setFolderTree] = useState<any>(null);
  const [imageList, setImageList] = useState<Array<ImageFile>>([]);
  const [imageRatings, setImageRatings] = useState<Record<string, number>>({});
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>({ key: 'name', order: SortDirection.Ascending });
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({
    colors: [],
    rating: 0,
    rawStatus: RawStatus.All,
  });
  const [supportedTypes, setSupportedTypes] = useState<SupportedTypes | null>(null);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [multiSelectedPaths, setMultiSelectedPaths] = useState<Array<string>>([]);
  const [libraryActivePath, setLibraryActivePath] = useState<string | null>(null);
  const [libraryActiveAdjustments, setLibraryActiveAdjustments] = useState<Adjustments>(INITIAL_ADJUSTMENTS);
  const [finalPreviewUrl, setFinalPreviewUrl] = useState<string | null>(null);
  const [uncroppedAdjustedPreviewUrl, setUncroppedAdjustedPreviewUrl] = useState<string | null>(null);
  const {
    state: historyAdjustments,
    setState: setHistoryAdjustments,
    undo: undoAdjustments,
    redo: redoAdjustments,
    canUndo,
    canRedo,
    resetHistory: resetAdjustmentsHistory,
  } = useHistoryState(INITIAL_ADJUSTMENTS);
  const [adjustments, setLiveAdjustments] = useState<Adjustments>(INITIAL_ADJUSTMENTS);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isTreeLoading, setIsTreeLoading] = useState(false);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [histogram, setHistogram] = useState<ChannelConfig | null>(null);
  const [waveform, setWaveform] = useState<WaveformData | null>(null);
  const [isWaveformVisible, setIsWaveformVisible] = useState(false);
  const [uiVisibility, setUiVisibility] = useState<UiVisibility>({
    folderTree: true,
    filmstrip: true,
  });
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isFullScreenLoading, setIsFullScreenLoading] = useState(false);
  const [fullScreenUrl, setFullScreenUrl] = useState<string | null>(null);
  const [theme, setTheme] = useState(DEFAULT_THEME_ID);
  const [adaptivePalette, setAdaptivePalette] = useState<any>(null);
  const [activeRightPanel, setActiveRightPanel] = useState<Panel | null>(Panel.Adjustments);
  const [activeMaskContainerId, setActiveMaskContainerId] = useState<string | null>(null);
  const [activeMaskId, setActiveMaskId] = useState<string | null>(null);
  const [activeAiPatchContainerId, setActiveAiPatchContainerId] = useState<string | null>(null);
  const [activeAiSubMaskId, setActiveAiSubMaskId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [baseRenderSize, setBaseRenderSize] = useState({ width: 0, height: 0 });
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });
  const [isFullResolution, setIsFullResolution] = useState(false);
  const [fullResolutionUrl, setFullResolutionUrl] = useState<string | null>(null);
  const [isLoadingFullRes, setIsLoadingFullRes] = useState(false);
  const fullResRequestRef = useRef<any>(null);

  // Track display size changes for zoom calculations
  const handleDisplaySizeChange = useCallback((size: any) => {
    setDisplaySize({ width: size.width, height: size.height });
    
    if (size.scale) {
      const baseWidth = size.width / size.scale;
      const baseHeight = size.height / size.scale;
      setBaseRenderSize({ width: baseWidth, height: baseHeight });
    }
  }, []);

  const [initialFitScale, setInitialFitScale] = useState<number | null>(null);

  // Initialize size tracking when image changes
  useEffect(() => {
    if (selectedImage && appSettings?.editorPreviewResolution) {
      setOriginalSize({ width: selectedImage.width, height: selectedImage.height });
      
      const maxSize = appSettings.editorPreviewResolution;
      const aspectRatio = selectedImage.width / selectedImage.height;
      
      if (selectedImage.width > selectedImage.height) {
        const width = Math.min(selectedImage.width, maxSize);
        const height = Math.round(width / aspectRatio);
        setPreviewSize({ width, height });
      } else {
        const height = Math.min(selectedImage.height, maxSize);
        const width = Math.round(height * aspectRatio);
        setPreviewSize({ width, height });
      }
      
      setIsFullResolution(false);
      setFullResolutionUrl(null);
    } else {
      setPreviewSize({ width: 0, height: 0 });
      setOriginalSize({ width: 0, height: 0 });
    }
  }, [selectedImage, appSettings?.editorPreviewResolution]);

  const [renderedRightPanel, setRenderedRightPanel] = useState<Panel | null>(activeRightPanel);
  const [collapsibleSectionsState, setCollapsibleSectionsState] = useState<CollapsibleSectionsState>({
    basic: true,
    color: false,
    curves: true,
    details: false,
    effects: false,
  });
  const [isLibraryExportPanelVisible, setIsLibraryExportPanelVisible] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(256);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(320);
  const [bottomPanelHeight, setBottomPanelHeight] = useState<number>(144);
  const [isResizing, setIsResizing] = useState(false);
  const [thumbnailSize, setThumbnailSize] = useState(ThumbnailSize.Medium);
  const [thumbnailAspectRatio, setThumbnailAspectRatio] = useState(ThumbnailAspectRatio.Cover);
  const [copiedAdjustments, setCopiedAdjustments] = useState<Adjustments | null>(null);
  const [isStraightenActive, setIsStraightenActive] = useState(false);
  const [copiedFilePaths, setCopiedFilePaths] = useState<Array<string>>([]);
  const [aiModelDownloadStatus, setAiModelDownloadStatus] = useState<string | null>(null);
  const [copiedSectionAdjustments, setCopiedSectionAdjustments] = useState(null);
  const [copiedMask, setCopiedMask] = useState<MaskContainer | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isPasted, setIsPasted] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState<Progress>({ current: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [brushSettings, setBrushSettings] = useState<BrushSettings | null>({
    size: 50,
    feather: 50,
    tool: ToolType.Brush,
  });
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isRenameFolderModalOpen, setIsRenameFolderModalOpen] = useState(false);
  const [isRenameFileModalOpen, setIsRenameFileModalOpen] = useState(false);
  const [renameTargetPaths, setRenameTargetPaths] = useState<Array<string>>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTargetFolder, setImportTargetFolder] = useState<string | null>(null);
  const [importSourcePaths, setImportSourcePaths] = useState<Array<string>>([]);
  const [folderActionTarget, setFolderActionTarget] = useState<string | null>(null);
  const [confirmModalState, setConfirmModalState] = useState<ConfirmModalState>({ isOpen: false });
  const [panoramaModalState, setPanoramaModalState] = useState<PanoramaModalState>({
    error: null,
    finalImageBase64: null,
    isOpen: false,
    progressMessage: '',
    stitchingSourcePaths: [],
  });
  const [customEscapeHandler, setCustomEscapeHandler] = useState(null);
  const [isGeneratingAiMask, setIsGeneratingAiMask] = useState(false);
  const [isComfyUiConnected, setIsComfyUiConnected] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isMaskControlHovered, setIsMaskControlHovered] = useState(false);
  const { showContextMenu } = useContextMenu();
  const imagePathList = useMemo(() => imageList.map((f: ImageFile) => f.path), [imageList]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  useThumbnails(imageList, setThumbnails);
  const transformWrapperRef = useRef<any>(null);
  const isProgrammaticZoom = useRef(false);
  const isInitialMount = useRef(true);
  const currentFolderPathRef = useRef<string>(currentFolderPath);

  const [exportState, setExportState] = useState<ExportState>({
    errorMessage: '',
    progress: { current: 0, total: 0 },
    status: Status.Idle,
  });

  const [importState, setImportState] = useState<ImportState>({
    errorMessage: '',
    path: '',
    progress: { current: 0, total: 0 },
    status: Status.Idle,
  });

  useEffect(() => {
    currentFolderPathRef.current = currentFolderPath;
  }, [currentFolderPath]);

  useEffect(() => {
    if (!isCopied) {
      return;
    }
    const timer = setTimeout(() => setIsCopied(false), 1000);
    return () => clearTimeout(timer);
  }, [isCopied]);
  useEffect(() => {
    if (!isPasted) {
      return;
    }
    const timer = setTimeout(() => setIsPasted(false), 1000);
    return () => clearTimeout(timer);
  }, [isPasted]);

  const debouncedSetHistory = useMemo(
    () => debounce((newAdjustments) => setHistoryAdjustments(newAdjustments), 300),
    [setHistoryAdjustments],
  );

  const setAdjustments = useCallback(
    (value: any) => {
      setLiveAdjustments((prevAdjustments: Adjustments) => {
        const newAdjustments = typeof value === 'function' ? value(prevAdjustments) : value;
        debouncedSetHistory(newAdjustments);
        return newAdjustments;
      });
    },
    [debouncedSetHistory],
  );

  const handleStraighten = useCallback(
    (angleCorrection: number) => {
      setAdjustments((prev: Partial<Adjustments>) => {
        const newRotation = (prev.rotation || 0) + angleCorrection;
        return { ...prev, rotation: newRotation, crop: null };
      });

      setIsStraightenActive(false);
    },
    [setAdjustments],
  );

  useEffect(() => {
    setLiveAdjustments(historyAdjustments);
  }, [historyAdjustments]);

  useEffect(() => {
    if (
      (activeRightPanel !== Panel.Masks || !activeMaskContainerId) &&
      (activeRightPanel !== Panel.Ai || !activeAiPatchContainerId)
    ) {
      setIsMaskControlHovered(false);
    }
  }, [activeRightPanel, activeMaskContainerId, activeAiPatchContainerId]);

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

  useEffect(() => {
    const unlisten = listen('comfyui-status-update', (event: any) => {
      setIsComfyUiConnected(event.payload.connected);
    });
    invoke(Invokes.CheckComfyuiStatus);
    const interval = setInterval(() => invoke(Invokes.CheckComfyuiStatus), 3000);
    return () => {
      clearInterval(interval);
      unlisten.then((f) => f());
    };
  }, []);

  const updateSubMask = (subMaskId: string, updatedData: any) => {
    setAdjustments((prev: Adjustments) => ({
      ...prev,
      masks: prev.masks.map((c: MaskContainer) => ({
        ...c,
        subMasks: c.subMasks.map((sm: SubMask) => (sm.id === subMaskId ? { ...sm, ...updatedData } : sm)),
      })),
      aiPatches: (prev.aiPatches || []).map((p: AiPatch) => ({
        ...p,
        subMasks: p.subMasks.map((sm: SubMask) => (sm.id === subMaskId ? { ...sm, ...updatedData } : sm)),
      })),
    }));
  };

  const handleGenerativeReplace = useCallback(
    async (patchId: string, prompt: string, useFastInpaint: boolean) => {
      if (!selectedImage?.path || isGeneratingAi) {
        return;
      }

      const patch: AiPatch | undefined = adjustments.aiPatches.find((p: AiPatch) => p.id === patchId);
      if (!patch) {
        console.error('Could not find AI patch to generate for:', patchId);
        return;
      }

      const patchDefinition = { ...patch, prompt };

      setAdjustments((prev: Adjustments) => ({
        ...prev,
        aiPatches: prev.aiPatches.map((p: AiPatch) => (p.id === patchId ? { ...p, isLoading: true, prompt } : p)),
      }));

      setIsGeneratingAi(true);

      try {
        const newPatchDataJson: any = await invoke(Invokes.InvokeGenerativeReplaseWithMaskDef, {
          currentAdjustments: adjustments,
          patchDefinition: patchDefinition,
          path: selectedImage.path,
          useFastInpaint: useFastInpaint,
        });

        const newPatchData = JSON.parse(newPatchDataJson);
        setAdjustments((prev: Adjustments) => ({
          ...prev,
          aiPatches: prev.aiPatches.map((p: AiPatch) =>
            p.id === patchId
              ? {
                  ...p,
                  patchData: newPatchData,
                  isLoading: false,
                  name: useFastInpaint ? 'Inpaint' : prompt && prompt.trim() ? prompt.trim() : p.name,
                }
              : p,
          ),
        }));
      } catch (err) {
        console.error('Generative replace failed:', err);
        setError(`AI Replace Failed: ${err}`);
        setAdjustments((prev: Adjustments) => ({
          ...prev,
          aiPatches: prev.aiPatches.map((p: AiPatch) => (p.id === patchId ? { ...p, isLoading: false } : p)),
        }));
      } finally {
        setIsGeneratingAi(false);
      }
    },
    [selectedImage?.path, isGeneratingAi, adjustments, setAdjustments],
  );

  const handleQuickErase = useCallback(
    async (subMaskId: string | null, startPoint: Coord, endPoint: Coord) => {
      if (!selectedImage?.path || isGeneratingAi) {
        return;
      }

      const patchId = adjustments.aiPatches.find((p: AiPatch) =>
        p.subMasks.some((sm: SubMask) => sm.id === subMaskId),
      )?.id;
      if (!patchId) {
        console.error('Could not find AI patch container for Quick Erase.');
        return;
      }

      setIsGeneratingAi(true);
      setAdjustments((prev: Partial<Adjustments>) => ({
        ...prev,
        aiPatches: prev.aiPatches?.map((p: AiPatch) => (p.id === patchId ? { ...p, isLoading: true } : p)),
      }));

      try {
        const newMaskParams: any = await invoke(Invokes.GenerateAiSubjectMask, {
          endPoint: [endPoint.x, endPoint.y],
          flipHorizontal: adjustments.flipHorizontal,
          flipVertical: adjustments.flipVertical,
          orientationSteps: adjustments.orientationSteps,
          path: selectedImage.path,
          rotation: adjustments.rotation,
          startPoint: [startPoint.x, startPoint.y],
        });

        const subMaskToUpdate = adjustments.aiPatches
          ?.find((p: AiPatch) => p.id === patchId)
          ?.subMasks.find((sm: SubMask) => sm.id === subMaskId);
        const finalSubMaskParams: any = { ...subMaskToUpdate?.parameters, ...newMaskParams };
        const updatedAdjustmentsForBackend = {
          ...adjustments,
          aiPatches: adjustments.aiPatches.map((p: AiPatch) =>
            p.id === patchId
              ? {
                  ...p,
                  subMasks: p.subMasks.map((sm: SubMask) =>
                    sm.id === subMaskId ? { ...sm, parameters: finalSubMaskParams } : sm,
                  ),
                }
              : p,
          ),
        };

        const patchDefinitionForBackend = updatedAdjustmentsForBackend.aiPatches.find((p: AiPatch) => p.id === patchId);
        const newPatchDataJson: any = await invoke(Invokes.InvokeGenerativeReplaseWithMaskDef, {
          currentAdjustments: updatedAdjustmentsForBackend,
          patchDefinition: { ...patchDefinitionForBackend, prompt: '' },
          path: selectedImage.path,
          useFastInpaint: true,
        });

        const newPatchData = JSON.parse(newPatchDataJson);
        if (!newPatchData?.color || !newPatchData?.mask) {
          throw new Error('Inpainting failed to return a valid result.');
        }

        setAdjustments((prev: Partial<Adjustments>) => ({
          ...prev,
          aiPatches: prev.aiPatches?.map((p: AiPatch) =>
            p.id === patchId
              ? {
                  ...p,
                  patchData: newPatchData,
                  isLoading: false,
                  name: 'Inpaint',
                  subMasks: p.subMasks.map((sm: SubMask) =>
                    sm.id === subMaskId ? { ...sm, parameters: finalSubMaskParams } : sm,
                  ),
                }
              : p,
          ),
        }));
        setActiveAiPatchContainerId(null);
        setActiveAiSubMaskId(null);
      } catch (err: any) {
        console.error('Quick Erase failed:', err);
        setError(`Quick Erase Failed: ${err.message || String(err)}`);
        setAdjustments((prev: Partial<Adjustments>) => ({
          ...prev,
          aiPatches: prev.aiPatches?.map((p: AiPatch) => (p.id === patchId ? { ...p, isLoading: false } : p)),
        }));
      } finally {
        setIsGeneratingAi(false);
      }
    },
    [
      selectedImage?.path,
      isGeneratingAi,
      adjustments,
      setAdjustments,
      setActiveAiPatchContainerId,
      setActiveAiSubMaskId,
    ],
  );

  const handleDeleteAiPatch = useCallback(
    (patchId: string) => {
      setAdjustments((prev: Adjustments) => ({
        ...prev,
        aiPatches: (prev.aiPatches || []).filter((p) => p.id !== patchId),
      }));
      if (activeAiPatchContainerId === patchId) {
        setActiveAiPatchContainerId(null);
        setActiveAiSubMaskId(null);
      }
    },
    [setAdjustments, activeAiPatchContainerId],
  );

  const handleToggleAiPatchVisibility = useCallback(
    (patchId: string) => {
      setAdjustments((prev: Adjustments) => ({
        ...prev,
        aiPatches: (prev.aiPatches || []).map((p: AiPatch) => (p.id === patchId ? { ...p, visible: !p.visible } : p)),
      }));
    },
    [setAdjustments],
  );

  const handleGenerateAiMask = async (subMaskId: string, startPoint: Coord, endPoint: Coord) => {
    if (!selectedImage?.path) {
      console.error('Cannot generate AI mask: No image selected.');
      return;
    }
    setIsGeneratingAiMask(true);
    try {
      const newParameters = await invoke(Invokes.GenerateAiSubjectMask, {
        endPoint: [endPoint.x, endPoint.y],
        flipHorizontal: adjustments.flipHorizontal,
        flipVertical: adjustments.flipVertical,
        orientationSteps: adjustments.orientationSteps,
        path: selectedImage.path,
        rotation: adjustments.rotation,
        startPoint: [startPoint.x, startPoint.y],
      });

      updateSubMask(subMaskId, { parameters: newParameters });
    } catch (error) {
      console.error('Failed to generate AI subject mask:', error);
      setError(`AI Mask Failed: ${error}`);
    } finally {
      setIsGeneratingAiMask(false);
    }
  };

  const handleGenerateAiForegroundMask = async (subMaskId: string) => {
    if (!selectedImage?.path) {
      console.error('Cannot generate AI mask: No image selected.');
      return;
    }
    setIsGeneratingAiMask(true);
    try {
      const newParameters = await invoke(Invokes.GenerateAiForegroundMask, {
        flipHorizontal: adjustments.flipHorizontal,
        flipVertical: adjustments.flipVertical,
        orientationSteps: adjustments.orientationSteps,
        rotation: adjustments.rotation,
      });

      updateSubMask(subMaskId, { parameters: newParameters });
    } catch (error) {
      console.error('Failed to generate AI foreground mask:', error);
      setError(`AI Mask Failed: ${error}`);
    } finally {
      setIsGeneratingAiMask(false);
    }
  };

  const sortedImageList = useMemo(() => {
    const filteredList = imageList.filter((image) => {
      if (filterCriteria.rating > 0) {
        const rating = imageRatings[image.path] || 0;
        if (filterCriteria.rating === 5) {
          if (rating !== 5) return false;
        } else {
          if (rating < filterCriteria.rating) return false;
        }
      }

      if (filterCriteria.rawStatus && filterCriteria.rawStatus !== RawStatus.All && supportedTypes) {
        const extension = image.path.split('.').pop()?.toLowerCase() || '';
        const isRaw = supportedTypes.raw?.includes(extension);

        if (filterCriteria.rawStatus === RawStatus.RawOnly && !isRaw) {
          return false;
        }
        if (filterCriteria.rawStatus === RawStatus.NonRawOnly && isRaw) {
          return false;
        }
      }

      if (filterCriteria.colors && filterCriteria.colors.length > 0) {
        const imageColor = (image.tags || []).find((tag: string) => tag.startsWith('color:'))?.substring(6);

        const hasMatchingColor = imageColor && filterCriteria.colors.includes(imageColor);
        const matchesNone = !imageColor && filterCriteria.colors.includes('none');

        if (!hasMatchingColor && !matchesNone) {
          return false;
        }
      }

      return true;
    });

    const filteredBySearch =
      searchQuery.trim() === ''
        ? filteredList
        : filteredList.filter((image: ImageFile) => {
            const query = searchQuery.toLowerCase();
            const filename = image?.path?.split(/[\\/]/)?.pop()?.toLowerCase();

            if (filename?.includes(query)) {
              return true;
            }

            if (appSettings?.enableAiTagging) {
              if (image.tags && image.tags.some((tag: string) => tag.toLowerCase().includes(query))) {
                return true;
              }
            }

            return false;
          });

    const list = [...filteredBySearch];

    list.sort((a, b) => {
      const { key, order } = sortCriteria;
      let comparison = 0;
      if (key === 'date') {
        comparison = a.modified - b.modified;
      } else if (key === 'rating') {
        comparison = (imageRatings[a.path] || 0) - (imageRatings[b.path] || 0);
      } else {
        comparison = a.path.localeCompare(b.path);
      }
      return order === SortDirection.Ascending ? comparison : -comparison;
    });
    return list;
  }, [imageList, sortCriteria, imageRatings, filterCriteria, supportedTypes, searchQuery, appSettings]);

  const applyAdjustments = useCallback(
    debounce((currentAdjustments) => {
      if (!selectedImage?.isReady) {
        return;
      }
      setIsAdjusting(true);
      setError(null);
      invoke(Invokes.ApplyAdjustments, { jsAdjustments: currentAdjustments }).catch((err) => {
        console.error('Failed to invoke apply_adjustments:', err);
        setError(`Processing failed: ${err}`);
        setIsAdjusting(false);
      });
    }, 50),
    [selectedImage?.isReady],
  );

  const debouncedGenerateUncroppedPreview = useCallback(
    debounce((currentAdjustments) => {
      if (!selectedImage?.isReady) {
        return;
      }
      invoke(Invokes.GenerateUncroppedPreview, { jsAdjustments: currentAdjustments }).catch((err) =>
        console.error('Failed to generate uncropped preview:', err),
      );
    }, 50),
    [selectedImage?.isReady],
  );

  const debouncedSave = useCallback(
    debounce((path, adjustmentsToSave) => {
      invoke(Invokes.SaveMetadataAndUpdateThumbnail, { path, adjustments: adjustmentsToSave }).catch((err) => {
        console.error('Auto-save failed:', err);
        setError(`Failed to save changes: ${err}`);
      });
    }, 300),
    [],
  );

  const createResizeHandler = (setter: any, startSize: number) => (e: any) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const doDrag = (moveEvent: any) => {
      if (setter === setLeftPanelWidth) {
        setter(Math.max(200, Math.min(startSize + (moveEvent.clientX - startX), 500)));
      } else if (setter === setRightPanelWidth) {
        setter(Math.max(280, Math.min(startSize - (moveEvent.clientX - startX), 600)));
      } else if (setter === setBottomPanelHeight) {
        setter(Math.max(100, Math.min(startSize - (moveEvent.clientY - startY), 400)));
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
  };

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const checkFullscreen = async () => {
      setIsWindowFullScreen(await appWindow.isFullscreen());
    };
    checkFullscreen();

    const unlistenPromise = appWindow.onResized(checkFullscreen);

    return () => {
      unlistenPromise.then((unlisten: any) => unlisten());
    };
  }, []);

  const handleRightPanelSelect = useCallback(
    (panelId: Panel) => {
      if (panelId === activeRightPanel) {
        setActiveRightPanel(null);
      } else {
        setActiveRightPanel(panelId);
        setRenderedRightPanel(panelId);
      }
      setActiveMaskId(null);
      setActiveAiSubMaskId(null);
    },
    [activeRightPanel],
  );

  const handleSettingsChange = useCallback(
    (newSettings: AppSettings) => {
      if (!newSettings) {
        console.error('handleSettingsChange was called with null settings. Aborting save operation.');
        return;
      }
      if (newSettings.theme && newSettings.theme !== theme) {
        setTheme(newSettings.theme);
      }
      setAppSettings(newSettings);
      invoke(Invokes.SaveSettings, { settings: newSettings }).catch((err) => {
        console.error('Failed to save settings:', err);
      });
    },
    [theme],
  );

  useEffect(() => {
    invoke(Invokes.LoadSettings)
      .then((settings: any) => {
        setAppSettings(settings);
        if (settings?.sortCriteria) setSortCriteria(settings.sortCriteria);
        if (settings?.filterCriteria) {
          setFilterCriteria((prev: FilterCriteria) => ({
            ...prev,
            ...settings.filterCriteria,
            rawStatus: settings.filterCriteria.rawStatus || RawStatus.All,
            colors: settings.filterCriteria.colors || [],
          }));
        }
        if (settings?.theme) {
          setTheme(settings.theme);
        }
        if (settings?.uiVisibility) {
          setUiVisibility((prev) => ({ ...prev, ...settings.uiVisibility }));
        }
        if (settings?.thumbnailSize) {
          setThumbnailSize(settings.thumbnailSize);
        }
        if (settings?.thumbnailAspectRatio) {
          setThumbnailAspectRatio(settings.thumbnailAspectRatio);
        }
      })
      .catch((err) => {
        console.error('Failed to load settings:', err);
        setAppSettings({ lastRootPath: null, theme: DEFAULT_THEME_ID });
      })
      .finally(() => {
        isInitialMount.current = false;
      });
  }, []);

  useEffect(() => {
    if (isInitialMount.current || !appSettings) {
      return;
    }
    if (JSON.stringify(appSettings.uiVisibility) !== JSON.stringify(uiVisibility)) {
      handleSettingsChange({ ...appSettings, uiVisibility });
    }
  }, [uiVisibility, appSettings, handleSettingsChange]);

  const handleToggleWaveform = useCallback(() => {
    setIsWaveformVisible((prev: boolean) => !prev);
  }, []);

  useEffect(() => {
    if (isInitialMount.current || !appSettings) {
      return;
    }
    if (appSettings.thumbnailSize !== thumbnailSize) {
      handleSettingsChange({ ...appSettings, thumbnailSize });
    }
  }, [thumbnailSize, appSettings, handleSettingsChange]);

  useEffect(() => {
    if (isInitialMount.current || !appSettings) {
      return;
    }
    if (appSettings.thumbnailAspectRatio !== thumbnailAspectRatio) {
      handleSettingsChange({ ...appSettings, thumbnailAspectRatio });
    }
  }, [thumbnailAspectRatio, appSettings, handleSettingsChange]);

  useEffect(() => {
    invoke(Invokes.GetSupportedFileTypes)
      .then((types: any) => setSupportedTypes(types))
      .catch((err) => console.error('Failed to load supported file types:', err));
  }, []);

  useEffect(() => {
    if (isInitialMount.current || !appSettings) {
      return;
    }
    if (JSON.stringify(appSettings.sortCriteria) !== JSON.stringify(sortCriteria)) {
      handleSettingsChange({ ...appSettings, sortCriteria });
    }
  }, [sortCriteria, appSettings, handleSettingsChange]);

  useEffect(() => {
    if (isInitialMount.current || !appSettings) {
      return;
    }
    if (JSON.stringify(appSettings.filterCriteria) !== JSON.stringify(filterCriteria)) {
      handleSettingsChange({ ...appSettings, filterCriteria });
    }
  }, [filterCriteria, appSettings, handleSettingsChange]);

  useEffect(() => {
    if (appSettings?.adaptiveEditorTheme && selectedImage && finalPreviewUrl) {
      generatePaletteFromImage(finalPreviewUrl)
        .then(setAdaptivePalette)
        .catch((err) => {
          const darkTheme = THEMES.find((t) => t.id === Theme.Dark);
          setAdaptivePalette(darkTheme ? darkTheme.cssVariables : null);
        });
    } else if (!appSettings?.adaptiveEditorTheme || !selectedImage) {
      setAdaptivePalette(null);
    }
  }, [appSettings?.adaptiveEditorTheme, selectedImage, finalPreviewUrl]);

  useEffect(() => {
    const root = document.documentElement;
    const currentThemeId = theme || DEFAULT_THEME_ID;

    const baseTheme =
      THEMES.find((t: ThemeProps) => t.id === currentThemeId) ||
      THEMES.find((t: ThemeProps) => t.id === DEFAULT_THEME_ID);
    if (!baseTheme) {
      return;
    }

    let finalCssVariables: any = { ...baseTheme.cssVariables };
    let effectThemeForWindow = baseTheme.id;

    if (adaptivePalette) {
      finalCssVariables = { ...finalCssVariables, ...adaptivePalette };
    }

    Object.entries(finalCssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value as string);
    });

    const isLight = [Theme.Light, Theme.Snow, Theme.Arctic].includes(effectThemeForWindow);
    invoke(Invokes.UpdateWindowEffect, { theme: isLight ? Theme.Light : Theme.Dark });
  }, [theme, adaptivePalette]);

  const handleRefreshFolderTree = useCallback(async () => {
    if (!rootPath) {
      return;
    }
    try {
      const treeData = await invoke(Invokes.GetFolderTree, { path: rootPath });
      setFolderTree(treeData);
    } catch (err) {
      console.error('Failed to refresh folder tree:', err);
      setError(`Failed to refresh folder tree: ${err}.`);
    }
  }, [rootPath]);

  const handleSelectSubfolder = useCallback(
    async (path: string | null, isNewRoot = false) => {
      setIsViewLoading(true);
      setSearchQuery('');
      try {
        setCurrentFolderPath(path);

        if (isNewRoot) {
          setExpandedFolders(new Set([path]));
        } else if (rootPath && path !== rootPath) {
          setExpandedFolders((prev) => {
            const newSet = new Set(prev);
            let current: string | undefined | null = path;
            const separator = current?.includes('/') ? '/' : '\\';

            const lastSeparatorIndex = current?.lastIndexOf(separator);
            if (lastSeparatorIndex && lastSeparatorIndex > -1 && lastSeparatorIndex >= rootPath.length) {
              current = current?.substring(0, lastSeparatorIndex);
            } else {
              current = null;
            }

            while (current && current.startsWith(rootPath) && current !== rootPath) {
              newSet.add(current);
              const parentSeparatorIndex = current.lastIndexOf(separator);
              if (parentSeparatorIndex === -1 || parentSeparatorIndex < rootPath.length) break;
              current = current.substring(0, parentSeparatorIndex);
            }
            newSet.add(rootPath);
            return newSet;
          });
        }

        const imageListPromise = invoke(Invokes.ListImagesInDir, { path });
        if (isNewRoot) {
          setIsTreeLoading(true);
          handleSettingsChange({ ...appSettings, lastRootPath: path } as AppSettings);
          try {
            const treeData = await invoke(Invokes.GetFolderTree, { path });
            setFolderTree(treeData);
          } catch (err) {
            console.error('Failed to load folder tree:', err);
            setError(`Failed to load folder tree: ${err}. Some sub-folders might be inaccessible.`);
          } finally {
            setIsTreeLoading(false);
          }
        }
        const [files]: any = await Promise.all([imageListPromise]);
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
        invoke(Invokes.StartBackgroundIndexing, { folderPath: path }).catch((err) => {
          console.error('Failed to start background indexing:', err);
        });
      } catch (err) {
        console.error('Failed to load folder contents:', err);
        setError('Failed to load images from the selected folder.');
        setIsTreeLoading(false);
      } finally {
        setIsViewLoading(false);
      }
    },
    [appSettings, handleSettingsChange, selectedImage, rootPath],
  );

  const handleLibraryRefresh = useCallback(() => {
    if (currentFolderPath) handleSelectSubfolder(currentFolderPath, false);
  }, [currentFolderPath, handleSelectSubfolder]);

  const handleToggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  useEffect(() => {
    if (isInitialMount.current || !appSettings || !rootPath) {
      return;
    }

    const newFolderState = {
      currentFolderPath,
      expandedFolders: Array.from(expandedFolders),
    };

    if (JSON.stringify(appSettings.lastFolderState) === JSON.stringify(newFolderState)) {
      return;
    }

    handleSettingsChange({ ...appSettings, lastFolderState: newFolderState });
  }, [currentFolderPath, expandedFolders, rootPath, appSettings, handleSettingsChange]);

  useEffect(() => {
    const handleGlobalContextMenu = (event: any) => {
      if (!DEBUG) event.preventDefault();
    };
    window.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => window.removeEventListener('contextmenu', handleGlobalContextMenu);
  }, []);

  const handleBackToLibrary = useCallback(() => {
    const lastActivePath = selectedImage?.path ?? null;
    setSelectedImage(null);
    setFinalPreviewUrl(null);
    setUncroppedAdjustedPreviewUrl(null);
    setHistogram(null);
    setWaveform(null);
    setIsWaveformVisible(false);
    setActiveMaskId(null);
    setActiveMaskContainerId(null);
    setActiveAiPatchContainerId(null);
    setActiveAiSubMaskId(null);
    setLibraryActivePath(lastActivePath);
  }, [selectedImage?.path]);

  const executeDelete = useCallback(
    async (pathsToDelete: Array<string>, options = { includeAssociated: false }) => {
      if (!pathsToDelete || pathsToDelete.length === 0) {
        return;
      }
      try {
        const command = options.includeAssociated ? 'delete_files_with_associated' : 'delete_files_from_disk';
        await invoke(command, { paths: pathsToDelete });

        handleLibraryRefresh();
        if (
          selectedImage &&
          pathsToDelete.some((p) => selectedImage.path.startsWith(p.substring(0, p.lastIndexOf('.'))))
        ) {
          handleBackToLibrary();
        }
        setMultiSelectedPaths([]);
        if (libraryActivePath && pathsToDelete.includes(libraryActivePath)) {
          setLibraryActivePath(null);
        }
      } catch (err) {
        console.error('Failed to delete files:', err);
        setError(`Failed to delete files: ${err}`);
      }
    },
    [handleLibraryRefresh, selectedImage, handleBackToLibrary, libraryActivePath],
  );

  const handleDeleteSelected = useCallback(() => {
    const pathsToDelete = multiSelectedPaths;
    if (pathsToDelete.length === 0) {
      return;
    }
    const isSingle = pathsToDelete.length === 1;
    setConfirmModalState({
      confirmText: 'Delete Selected Only',
      confirmVariant: 'destructive',
      isOpen: true,
      message: `Are you sure you want to permanently delete ${
        isSingle ? 'this image' : `${pathsToDelete.length} images`
      }? This action cannot be undone. Right-click for more options (e.g., deleting associated RAW/JPEG files).`,
      onConfirm: () => executeDelete(pathsToDelete, { includeAssociated: false }),
      title: 'Confirm Delete',
    });
  }, [multiSelectedPaths, executeDelete]);

  const handleToggleFullScreen = useCallback(() => {
    if (isFullScreen) {
      setIsFullScreen(false);
      setFullScreenUrl(null);
    } else {
      if (!selectedImage) {
        return;
      }
      setIsFullScreen(true);
    }
  }, [isFullScreen, selectedImage]);

  useEffect(() => {
    if (!isFullScreen || !selectedImage?.isReady) {
      return;
    }

    const generate = async () => {
      setIsFullScreenLoading(true);
      try {
        const url: string = await invoke(Invokes.GenerateFullscreenPreview, { jsAdjustments: adjustments });
        setFullScreenUrl(url);
      } catch (e) {
        console.error('Failed to generate fullscreen preview:', e);
        setError('Failed to generate full screen preview.');
      } finally {
        setIsFullScreenLoading(false);
      }
    };
    generate();
  }, [isFullScreen, selectedImage?.path, selectedImage?.isReady, adjustments]);

  const handleCopyAdjustments = useCallback(() => {
    const sourceAdjustments = selectedImage ? adjustments : libraryActiveAdjustments;
    const adjustmentsToCopy: any = {};
    for (const key of COPYABLE_ADJUSTMENT_KEYS) {
      if (sourceAdjustments.hasOwnProperty(key)) adjustmentsToCopy[key] = sourceAdjustments[key];
    }
    setCopiedAdjustments(adjustmentsToCopy);
    setIsCopied(true);
  }, [selectedImage, adjustments, libraryActiveAdjustments]);

  const handlePasteAdjustments = useCallback(
    (paths?: Array<string>) => {
      if (!copiedAdjustments) {
        return;
      }
      const pathsToUpdate =
        paths || (multiSelectedPaths.length > 0 ? multiSelectedPaths : selectedImage ? [selectedImage.path] : []);
      if (pathsToUpdate.length === 0) {
        return;
      }
      if (selectedImage && pathsToUpdate.includes(selectedImage.path)) {
        const newAdjustments = { ...adjustments, ...copiedAdjustments };
        setAdjustments(newAdjustments);
      }
      invoke(Invokes.ApplyAdjustmentsToPaths, { paths: pathsToUpdate, adjustments: copiedAdjustments }).catch((err) => {
        console.error('Failed to paste adjustments to multiple images:', err);
        setError(`Failed to paste adjustments: ${err}`);
      });
      setIsPasted(true);
    },
    [copiedAdjustments, multiSelectedPaths, selectedImage, adjustments, setAdjustments],
  );

  const handleAutoAdjustments = async () => {
    if (!selectedImage) {
      return;
    }
    try {
      const autoAdjustments: Adjustments = await invoke(Invokes.CalculateAutoAdjustments);
      setAdjustments((prev: Adjustments) => {
        const newAdjustments = { ...prev, ...autoAdjustments };
        newAdjustments.sectionVisibility = {
          ...prev.sectionVisibility,
          ...autoAdjustments.sectionVisibility,
        };

        return newAdjustments;
      });
    } catch (err) {
      console.error('Failed to calculate auto adjustments:', err);
      setError(`Failed to apply auto adjustments: ${err}`);
    }
  };

  const handleRate = useCallback(
    (newRating: number, paths?: Array<string>) => {
      const pathsToRate =
        paths || (multiSelectedPaths.length > 0 ? multiSelectedPaths : selectedImage ? [selectedImage.path] : []);
      if (pathsToRate.length === 0) {
        return;
      }

      let currentRating = 0;
      if (selectedImage && pathsToRate.includes(selectedImage.path)) {
        currentRating = adjustments.rating;
      } else if (libraryActivePath && pathsToRate.includes(libraryActivePath)) {
        currentRating = libraryActiveAdjustments.rating;
      }

      const finalRating = newRating === currentRating ? 0 : newRating;

      setImageRatings((prev: Record<string, number>) => {
        const newRatings = { ...prev };
        pathsToRate.forEach((path: string) => {
          newRatings[path] = finalRating;
        });
        return newRatings;
      });

      if (selectedImage && pathsToRate.includes(selectedImage.path)) {
        setAdjustments((prev: Adjustments) => ({ ...prev, rating: finalRating }));
      }

      if (libraryActivePath && pathsToRate.includes(libraryActivePath)) {
        setLibraryActiveAdjustments((prev) => ({ ...prev, rating: finalRating }));
      }

      invoke(Invokes.ApplyAdjustmentsToPaths, { paths: pathsToRate, adjustments: { rating: finalRating } }).catch(
        (err) => {
          console.error('Failed to apply rating to paths:', err);
          setError(`Failed to apply rating: ${err}`);
        },
      );
    },
    [
      multiSelectedPaths,
      selectedImage,
      libraryActivePath,
      adjustments.rating,
      libraryActiveAdjustments.rating,
      setAdjustments,
    ],
  );

  const handleSetColorLabel = useCallback(
    async (color: string | null, paths?: Array<string>) => {
      const pathsToUpdate =
        paths || (multiSelectedPaths.length > 0 ? multiSelectedPaths : selectedImage ? [selectedImage.path] : []);
      if (pathsToUpdate.length === 0) {
        return;
      }
      const primaryPath = selectedImage?.path || libraryActivePath;
      const primaryImage = imageList.find((img: ImageFile) => img.path === primaryPath);
      let currentColor = null;
      if (primaryImage && primaryImage.tags) {
        const colorTag = primaryImage.tags.find((tag: string) => tag.startsWith('color:'));
        if (colorTag) {
          currentColor = colorTag.substring(6);
        }
      }
      const finalColor = color !== null && color === currentColor ? null : color;
      try {
        await invoke(Invokes.SetColorLabelForPaths, { paths: pathsToUpdate, color: finalColor });

        setImageList((prevList: Array<ImageFile>) =>
          prevList.map((image: ImageFile) => {
            if (pathsToUpdate.includes(image.path)) {
              const otherTags = (image.tags || []).filter((tag: string) => !tag.startsWith('color:'));
              const newTags = finalColor ? [...otherTags, `color:${finalColor}`] : otherTags;
              return { ...image, tags: newTags };
            }
            return image;
          }),
        );
      } catch (err) {
        console.error('Failed to set color label:', err);
        setError(`Failed to set color label: ${err}`);
      }
    },
    [multiSelectedPaths, selectedImage, libraryActivePath, imageList],
  );

  const closeConfirmModal = () => setConfirmModalState({ ...confirmModalState, isOpen: false });

  const handlePasteFiles = useCallback(
    async (mode = 'copy') => {
      if (copiedFilePaths.length === 0 || !currentFolderPath) {
        return;
      }
      try {
        if (mode === 'copy')
          await invoke(Invokes.CopyFiles, { sourcePaths: copiedFilePaths, destinationFolder: currentFolderPath });
        else {
          await invoke(Invokes.MoveFiles, { sourcePaths: copiedFilePaths, destinationFolder: currentFolderPath });
          setCopiedFilePaths([]);
        }
        handleLibraryRefresh();
      } catch (err) {
        setError(`Failed to ${mode} files: ${err}`);
      }
    },
    [copiedFilePaths, currentFolderPath, handleLibraryRefresh],
  );

  // Request full resolution preview when zoomed in
  const requestFullResolution = useCallback(
    debounce((currentAdjustments: any) => {
      if (!selectedImage?.path) return;
      
      if (fullResRequestRef.current) {
        fullResRequestRef.current.cancelled = true;
      }
      
      const request = { cancelled: false };
      fullResRequestRef.current = request;
      
      invoke('generate_fullscreen_preview', {
        jsAdjustments: currentAdjustments
      }).then((fullResUrl: string) => {
        if (!request.cancelled) {
          setFullResolutionUrl(fullResUrl);
          setIsFullResolution(true);
          setIsLoadingFullRes(false);
        }
      }).catch((error: any) => {
        if (!request.cancelled) {
          console.error('Failed to generate full resolution preview:', error);
          setIsFullResolution(false);
          setFullResolutionUrl(null);
          setIsLoadingFullRes(false);
        }
      });
    }, 300),
    [selectedImage?.path]
  );
  
  // Regenerate full resolution when adjustments change while zoomed
  useEffect(() => {
    if (isFullResolution && selectedImage?.path) {
      setFullResolutionUrl(null);
      setIsLoadingFullRes(true);
      requestFullResolution(adjustments);
    }
  }, [adjustments, isFullResolution, selectedImage?.path, requestFullResolution]);

  // Handle zoom changes with percentage relative to original image size
  const handleZoomChange = useCallback((input: number | string) => {
    let targetZoomPercent = input;
    
    if (input === 'fit-to-window') {
      if (originalSize.width > 0 && originalSize.height > 0 && baseRenderSize.width > 0 && baseRenderSize.height > 0) {
        const originalAspect = originalSize.width / originalSize.height;
        const baseAspect = baseRenderSize.width / baseRenderSize.height;
        
        if (originalAspect > baseAspect) {
          targetZoomPercent = baseRenderSize.width / originalSize.width;
        } else {
          targetZoomPercent = baseRenderSize.height / originalSize.height;
        }
      } else {
        targetZoomPercent = 1.0;
      }
    }
    
    targetZoomPercent = Math.max(0.1, Math.min(2.0, Number(targetZoomPercent)));
    
    let transformZoom = 1.0;
    if (originalSize.width > 0 && originalSize.height > 0 && baseRenderSize.width > 0 && baseRenderSize.height > 0) {
      const originalAspect = originalSize.width / originalSize.height;
      const baseAspect = baseRenderSize.width / baseRenderSize.height;
      
      if (originalAspect > baseAspect) {
        transformZoom = (targetZoomPercent * originalSize.width) / baseRenderSize.width;
      } else {
        transformZoom = (targetZoomPercent * originalSize.height) / baseRenderSize.height;
      }
    }
    
    isProgrammaticZoom.current = true;
    setZoom(transformZoom);
    
    const needsFullRes = targetZoomPercent > 0.5;
    const currentDisplayWidth = baseRenderSize.width * transformZoom;
    const shouldUsePreview = previewSize.width > 0 && currentDisplayWidth <= previewSize.width;
    
    if (needsFullRes && !isFullResolution && !shouldUsePreview) {
      if (!isLoadingFullRes) {
        setIsLoadingFullRes(true);
        requestFullResolution(adjustments);
      }
    } else if ((!needsFullRes || shouldUsePreview)) {
      if (fullResRequestRef.current) {
        fullResRequestRef.current.cancelled = true;
      }
      if (requestFullResolution.cancel) {
        requestFullResolution.cancel();
      }
      if (isFullResolution) {
        setIsFullResolution(false);
        setFullResolutionUrl(null);
      }
      if (isLoadingFullRes) {
        setIsLoadingFullRes(false);
      }
    }
  }, [originalSize, baseRenderSize, previewSize, isFullResolution, isLoadingFullRes, requestFullResolution, adjustments]);

  // Handle manual zoom via mouse/trackpad
  const handleUserTransform = useCallback((transformState: TransformState) => {
    if (isProgrammaticZoom.current) {
      isProgrammaticZoom.current = false;
      return;
    }

    setZoom(transformState.scale);

    if (originalSize.width > 0 && baseRenderSize.width > 0) {
      const targetZoomPercent = (baseRenderSize.width * transformState.scale) / originalSize.width;
      const currentDisplayWidth = baseRenderSize.width * transformState.scale;
      const shouldUsePreview = previewSize.width > 0 && currentDisplayWidth <= previewSize.width;
      const needsFullRes = targetZoomPercent > 0.5;
      
      if (needsFullRes && !isFullResolution && !shouldUsePreview) {
        if (!isLoadingFullRes) {
          setIsLoadingFullRes(true);
          requestFullResolution(adjustments);
        }
      } else if ((!needsFullRes || shouldUsePreview)) {
        if (fullResRequestRef.current) {
          fullResRequestRef.current.cancelled = true;
        }
        if (requestFullResolution.cancel) {
          requestFullResolution.cancel();
        }
        if (isFullResolution) {
          setIsFullResolution(false);
          setFullResolutionUrl(null);
        }
        if (isLoadingFullRes) {
          setIsLoadingFullRes(false);
        }
      }
    }
  }, [originalSize, baseRenderSize, previewSize, isFullResolution, isLoadingFullRes, requestFullResolution, adjustments]);

  const handleImageSelect = useCallback(
    (path: string) => {
      if (selectedImage?.path === path) {
        return;
      }
      applyAdjustments.cancel();
      debouncedSave.cancel();

      setSelectedImage({
        exif: null,
        height: 0,
        isRaw: false,
        isReady: false,
        metadata: null,
        originalUrl: null,
        path,
        thumbnailUrl: thumbnails[path],
        width: 0,
      });
      setMultiSelectedPaths([path]);
      setLibraryActivePath(null);
      setIsViewLoading(true);
      setError(null);
      setHistogram(null);
      setFinalPreviewUrl(null);
      setUncroppedAdjustedPreviewUrl(null);
      setFullScreenUrl(null);
      setLiveAdjustments(INITIAL_ADJUSTMENTS);
      resetAdjustmentsHistory(INITIAL_ADJUSTMENTS);
      setShowOriginal(false);
      setActiveMaskId(null);
      setActiveMaskContainerId(null);
      setActiveAiPatchContainerId(null);
      setActiveAiSubMaskId(null);

      if (transformWrapperRef.current) {
        transformWrapperRef.current.resetTransform(0);
      }

      setZoom(1);
      setIsLibraryExportPanelVisible(false);
    },
    [selectedImage?.path, applyAdjustments, debouncedSave, thumbnails, resetAdjustmentsHistory],
  );

  useKeyboardShortcuts({
    activeAiSubMaskId,
    activeMaskId,
    activeRightPanel,
    canRedo,
    canUndo,
    copiedFilePaths,
    customEscapeHandler,
    handleBackToLibrary,
    handleCopyAdjustments,
    handleDeleteSelected,
    handleImageSelect,
    handlePasteAdjustments,
    handlePasteFiles,
    handleRate,
    handleRightPanelSelect,
    handleSetColorLabel,
    handleToggleFullScreen,
    handleZoomChange,
    isFullScreen,
    isStraightenActive,
    isViewLoading,
    libraryActivePath,
    multiSelectedPaths,
    redo,
    selectedImage,
    setActiveAiSubMaskId,
    setActiveMaskId,
    setCopiedFilePaths,
    setIsStraightenActive,
    setIsWaveformVisible,
    setLibraryActivePath,
    setMultiSelectedPaths,
    setShowOriginal,
    sortedImageList,
    undo,
    zoom,
    displaySize,
    baseRenderSize,
    originalSize,
  });

  useEffect(() => {
    let isEffectActive = true;
    const listeners = [
      listen('preview-update-final', (event: any) => {
        if (isEffectActive) {
          setFinalPreviewUrl(event.payload);
          setIsAdjusting(false);
        }
      }),
      listen('preview-update-uncropped', (event: any) => {
        if (isEffectActive) {
          setUncroppedAdjustedPreviewUrl(event.payload);
        }
      }),
      listen('histogram-update', (event: any) => {
        if (isEffectActive) {
          setHistogram(event.payload);
        }
      }),
      listen('waveform-update', (event: any) => {
        if (isEffectActive) {
          setWaveform(event.payload);
        }
      }),
      listen('thumbnail-generated', (event: any) => {
        if (isEffectActive) {
          const { path, data, rating } = event.payload;
          if (data) {
            setThumbnails((prev) => ({ ...prev, [path]: data }));
          }
          if (rating !== undefined) {
            setImageRatings((prev) => ({ ...prev, [path]: rating }));
          }
        }
      }),
      listen('ai-model-download-start', (event: any) => {
        if (isEffectActive) {
          setAiModelDownloadStatus(event.payload);
        }
      }),
      listen('ai-model-download-finish', () => {
        if (isEffectActive) {
          setAiModelDownloadStatus(null);
        }
      }),
      listen('indexing-started', () => {
        if (isEffectActive) {
          setIsIndexing(true);
          setIndexingProgress({ current: 0, total: 0 });
        }
      }),
      listen('indexing-progress', (event: any) => {
        if (isEffectActive) {
          setIndexingProgress(event.payload);
        }
      }),
      listen('indexing-finished', () => {
        if (isEffectActive) {
          setIsIndexing(false);
          setIndexingProgress({ current: 0, total: 0 });
          if (currentFolderPathRef.current) {
            const refreshImageList = async () => {
              try {
                const list: ImageFile[] = await invoke(Invokes.ListImagesInDir, { path: currentFolderPathRef.current });
                if (Array.isArray(list)) {
                  setImageList(list);
                }
              } catch (err) {
                console.error('Failed to refresh after indexing:', err);
              }
            };
            refreshImageList();
          }
        }
      }),
      listen('batch-export-progress', (event: any) => {
        if (isEffectActive) {
          setExportState((prev: ExportState) => ({ ...prev, progress: event.payload }));
        }
      }),
      listen('export-complete', () => {
        if (isEffectActive) {
          setExportState((prev: ExportState) => ({ ...prev, status: Status.Success }));
        }
      }),
      listen('export-error', (event) => {
        if (isEffectActive) {
          setExportState((prev: ExportState) => ({
            ...prev,
            status: Status.Error,
            errorMessage: typeof event.payload === 'string' ? event.payload : 'An unknown export error occurred.',
          }));
        }
      }),
      listen('export-cancelled', () => {
        if (isEffectActive) {
          setExportState((prev: ExportState) => ({ ...prev, status: Status.Cancelled }));
        }
      }),
      listen('import-start', (event: any) => {
        if (isEffectActive) {
          setImportState({
            errorMessage: '',
            path: '',
            progress: { current: 0, total: event.payload.total },
            status: Status.Importing,
          });
        }
      }),
      listen('import-progress', (event: any) => {
        if (isEffectActive) {
          setImportState((prev: ImportState) => ({
            ...prev,
            path: event.payload.path,
            progress: { current: event.payload.current, total: event.payload.total },
          }));
        }
      }),
      listen('import-complete', () => {
        if (isEffectActive) {
          setImportState((prev: ImportState) => ({ ...prev, status: Status.Success }));
          handleRefreshFolderTree();
          if (currentFolderPathRef.current) {
            handleSelectSubfolder(currentFolderPathRef.current, false);
          }
        }
      }),
      listen('import-error', (event) => {
        if (isEffectActive) {
          setImportState((prev: ImportState) => ({
            ...prev,
            errorMessage: typeof event.payload === 'string' ? event.payload : 'An unknown import error occurred.',
            status: Status.Error,
          }));
        }
      }),
    ];
    return () => {
      isEffectActive = false;
      listeners.forEach((p) => p.then((unlisten) => unlisten()));
    };
  }, [handleRefreshFolderTree, handleSelectSubfolder]);

  useEffect(() => {
    if ([Status.Success, Status.Error, Status.Cancelled].includes(exportState.status)) {
      const timer = setTimeout(() => {
        setExportState({ status: Status.Idle, progress: { current: 0, total: 0 }, errorMessage: '' });
      }, EXPORT_TIMEOUT);
      return () => clearTimeout(timer);
    }
  }, [exportState.status]);

  useEffect(() => {
    if ([Status.Success, Status.Error].includes(importState.status)) {
      const timer = setTimeout(() => {
        setImportState({ status: Status.Idle, progress: { current: 0, total: 0 }, path: '', errorMessage: '' });
      }, IMPORT_TIMEOUT);

      return () => clearTimeout(timer);
    }
  }, [importState.status]);

  useEffect(() => {
    if (libraryActivePath) {
      invoke(Invokes.LoadMetadata, { path: libraryActivePath })
        .then((metadata: any) => {
          if (metadata.adjustments && !metadata.adjustments.is_null) {
            const normalized: Adjustments = normalizeLoadedAdjustments(metadata.adjustments);
            setLibraryActiveAdjustments(normalized);
          } else {
            setLibraryActiveAdjustments(INITIAL_ADJUSTMENTS);
          }
        })
        .catch((err) => {
          console.error('Failed to load metadata for library active image', err);
          setLibraryActiveAdjustments(INITIAL_ADJUSTMENTS);
        });
    } else {
      setLibraryActiveAdjustments(INITIAL_ADJUSTMENTS);
    }
  }, [libraryActivePath]);

  useEffect(() => {
    let isEffectActive = true;

    const unlistenProgress = listen('panorama-progress', (event: any) => {
      if (isEffectActive) {
        setPanoramaModalState((prev: PanoramaModalState) => ({
          ...prev,
          error: null,
          finalImageBase64: null,
          isOpen: true,
          progressMessage: event.payload,
        }));
      }
    });

    const unlistenComplete = listen('panorama-complete', (event: any) => {
      if (isEffectActive) {
        const { base64 } = event.payload;
        setPanoramaModalState((prev: PanoramaModalState) => ({
          ...prev,
          error: null,
          finalImageBase64: base64,
          progressMessage: 'Panorama Ready',
        }));
      }
    });

    const unlistenError = listen('panorama-error', (event: any) => {
      if (isEffectActive) {
        setPanoramaModalState((prev: PanoramaModalState) => ({
          ...prev,
          error: String(event.payload),
          finalImageBase64: null,
          progressMessage: 'An error occurred.',
        }));
      }
    });

    return () => {
      isEffectActive = false;
      unlistenProgress.then((f: any) => f());
      unlistenComplete.then((f: any) => f());
      unlistenError.then((f: any) => f());
    };
  }, []);

  const handleSavePanorama = async (): Promise<string> => {
    if (panoramaModalState.stitchingSourcePaths.length === 0) {
      const err = 'Source paths for panorama not found.';
      setPanoramaModalState((prev: PanoramaModalState) => ({ ...prev, error: err }));
      throw new Error(err);
    }

    try {
      const savedPath: string = await invoke(Invokes.SavePanorama, {
        firstPathStr: panoramaModalState.stitchingSourcePaths[0],
      });
      handleLibraryRefresh();
      return savedPath;
    } catch (err) {
      console.error('Failed to save panorama:', err);
      setPanoramaModalState((prev: PanoramaModalState) => ({ ...prev, error: String(err) }));
      throw err;
    }
  };

  useEffect(() => {
    if (selectedImage?.isReady) {
      applyAdjustments(adjustments);
      debouncedSave(selectedImage.path, adjustments);
    }
    return () => {
      applyAdjustments.cancel();
      debouncedSave.cancel();
    };
  }, [adjustments, selectedImage?.path, selectedImage?.isReady, applyAdjustments, debouncedSave]);

  useEffect(() => {
    if (activeRightPanel === Panel.Crop && selectedImage?.isReady) {
      debouncedGenerateUncroppedPreview(adjustments);
    }

    return () => debouncedGenerateUncroppedPreview.cancel();
  }, [adjustments, activeRightPanel, selectedImage?.isReady, debouncedGenerateUncroppedPreview]);

  const handleOpenFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, defaultPath: await homeDir() });
      if (typeof selected === 'string') {
        setRootPath(selected);
        await handleSelectSubfolder(selected, true);
      }
    } catch (err) {
      console.error('Failed to open directory dialog:', err);
      setError('Failed to open folder selection dialog.');
    }
  };

  const handleContinueSession = () => {
    const restore = async () => {
      if (!appSettings?.lastRootPath) {
        return;
      }

      const root = appSettings.lastRootPath;
      const folderState = appSettings.lastFolderState;
      const pathToSelect =
        folderState?.currentFolderPath && folderState.currentFolderPath.startsWith(root)
          ? folderState.currentFolderPath
          : root;

      setRootPath(root);

      if (folderState?.expandedFolders) {
        const newExpandedFolders = new Set(folderState.expandedFolders);
        newExpandedFolders.add(root);
        setExpandedFolders(newExpandedFolders);
      } else {
        setExpandedFolders(new Set([root]));
      }

      setIsTreeLoading(true);
      try {
        const treeData = await invoke(Invokes.GetFolderTree, { path: root });
        setFolderTree(treeData);
      } catch (err) {
        console.error('Failed to load folder tree:', err);
        setError(`Failed to load folder tree: ${err}.`);
      } finally {
        setIsTreeLoading(false);
      }

      await handleSelectSubfolder(pathToSelect, false);
    };
    restore().catch((err) => {
      console.error('Failed to restore session:', err);
      setError('Failed to restore session.');
    });
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
    setExpandedFolders(new Set());
  };

  const handleMultiSelectClick = (path: string, event: any, options: MultiSelectOptions) => {
    const { ctrlKey, metaKey, shiftKey } = event;
    const isCtrlPressed = ctrlKey || metaKey;
    const { shiftAnchor, onSimpleClick, updateLibraryActivePath } = options;

    if (shiftKey && shiftAnchor) {
      const lastIndex = sortedImageList.findIndex((f) => f.path === shiftAnchor);
      const currentIndex = sortedImageList.findIndex((f) => f.path === path);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const range = sortedImageList.slice(start, end + 1).map((f: ImageFile) => f.path);
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

  const handleLibraryImageSingleClick = (path: string, event: any) => {
    handleMultiSelectClick(path, event, {
      shiftAnchor: libraryActivePath,
      updateLibraryActivePath: true,
      onSimpleClick: (p: any) => {
        setMultiSelectedPaths([p]);
        setLibraryActivePath(p);
      },
    });
  };

  const handleImageClick = (path: string, event: any) => {
    const inEditor = !!selectedImage;
    handleMultiSelectClick(path, event, {
      shiftAnchor: inEditor ? selectedImage.path : libraryActivePath,
      updateLibraryActivePath: !inEditor,
      onSimpleClick: handleImageSelect,
    });
  };

  useEffect(() => {
    const invokeWaveForm = async () => {
      const waveForm: any = await invoke(Invokes.GenerateWaveform).catch((err) =>
        console.error('Failed to generate waveform:', err),
      );
      if (waveForm) {
        setWaveform(waveForm);
      }
    };

    if (isWaveformVisible && selectedImage?.isReady && !waveform) {
      invokeWaveForm();
    }
  }, [isWaveformVisible, selectedImage?.isReady, waveform]);

  useEffect(() => {
    if (selectedImage && !selectedImage.isReady && selectedImage.path) {
      let isEffectActive = true;
      const loadFullImageData = async () => {
        try {
          const loadImageResult: any = await invoke(Invokes.LoadImage, { path: selectedImage.path });
          if (!isEffectActive) {
            return;
          }
          const histData: any = await invoke(Invokes.GenerateHistogram);
          if (!isEffectActive) {
            return;
          }
          setSelectedImage((currentSelected: SelectedImage | null) => {
            if (currentSelected && currentSelected.path === selectedImage.path) {
              return {
                ...currentSelected,
                exif: loadImageResult.exif,
                height: loadImageResult.height,
                isRaw: loadImageResult.is_raw,
                isReady: true,
                metadata: loadImageResult.metadata,
                originalUrl: loadImageResult.original_base64,
                width: loadImageResult.width,
              };
            }
            return currentSelected;
          });

          let initialAdjusts;
          if (loadImageResult.metadata.adjustments && !loadImageResult.metadata.adjustments.is_null) {
            initialAdjusts = normalizeLoadedAdjustments(loadImageResult.metadata.adjustments);
          } else {
            initialAdjusts = {
              ...INITIAL_ADJUSTMENTS,
              aspectRatio: loadImageResult.width / loadImageResult.height,
            };
          }
          if (loadImageResult.metadata.adjustments && !loadImageResult.metadata.adjustments.is_null) {
            initialAdjusts = normalizeLoadedAdjustments(loadImageResult.metadata.adjustments);
          }
          setLiveAdjustments(initialAdjusts);
          resetAdjustmentsHistory(initialAdjusts);
          setHistogram(histData);
        } catch (err) {
          if (isEffectActive) {
            console.error('Failed to load image:', err);
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

  const handleClearSelection = () => {
    if (selectedImage) {
      setMultiSelectedPaths([selectedImage.path]);
    } else {
      setMultiSelectedPaths([]);
      setLibraryActivePath(null);
    }
  };

  const handleRenameFiles = useCallback(async (paths: Array<string>) => {
    if (paths && paths.length > 0) {
      setRenameTargetPaths(paths);
      setIsRenameFileModalOpen(true);
    }
  }, []);

  const handleSaveRename = useCallback(
    async (nameTemplate: string) => {
      if (renameTargetPaths.length > 0 && nameTemplate) {
        try {
          const newPaths: Array<string> = await invoke(Invokes.RenameFiles, {
            nameTemplate,
            paths: renameTargetPaths,
          });

          handleLibraryRefresh();

          if (selectedImage && renameTargetPaths.includes(selectedImage.path)) {
            const oldPathIndex = renameTargetPaths.indexOf(selectedImage.path);

            if (newPaths[oldPathIndex]) {
              handleImageSelect(newPaths[oldPathIndex]);
            } else {
              handleBackToLibrary();
            }
          }

          if (libraryActivePath && renameTargetPaths.includes(libraryActivePath)) {
            const oldPathIndex = renameTargetPaths.indexOf(libraryActivePath);

            if (newPaths[oldPathIndex]) {
              setLibraryActivePath(newPaths[oldPathIndex]);
            } else {
              setLibraryActivePath(null);
            }
          }

          setMultiSelectedPaths(newPaths);
        } catch (err) {
          setError(`Failed to rename files: ${err}`);
        }
      }

      setRenameTargetPaths([]);
    },
    [renameTargetPaths, handleLibraryRefresh, selectedImage, libraryActivePath, handleImageSelect, handleBackToLibrary],
  );

  const handleStartImport = async (settings: AppSettings) => {
    if (importSourcePaths.length > 0 && importTargetFolder) {
      invoke(Invokes.ImportFiles, {
        destinationFolder: importTargetFolder,
        settings: settings,
        sourcePaths: importSourcePaths,
      }).catch((err) => {
        console.error('Failed to start import:', err);
        setImportState({ status: Status.Error, errorMessage: `Failed to start import: ${err}` });
      });
    }
  };

  const handleResetAdjustments = useCallback(
    (paths?: Array<string>) => {
      const pathsToReset = paths || multiSelectedPaths;
      if (pathsToReset.length === 0) {
        return;
      }

      debouncedSetHistory.cancel();

      invoke(Invokes.ResetAdjustmentsForPaths, { paths: pathsToReset })
        .then(() => {
          if (libraryActivePath && pathsToReset.includes(libraryActivePath)) {
            setLibraryActiveAdjustments((prev: Adjustments) => ({ ...INITIAL_ADJUSTMENTS, rating: prev.rating }));
          }
          if (selectedImage && pathsToReset.includes(selectedImage.path)) {
            const currentRating = adjustments.rating;
            resetAdjustmentsHistory({ ...INITIAL_ADJUSTMENTS, rating: currentRating, aiPatches: [] });
          }
        })
        .catch((err) => {
          console.error('Failed to reset adjustments:', err);
          setError(`Failed to reset adjustments: ${err}`);
        });
    },
    [multiSelectedPaths, libraryActivePath, selectedImage, adjustments.rating, resetAdjustmentsHistory, debouncedSetHistory],
  );

  const handleImportClick = useCallback(
    async (targetPath: string) => {
      try {
        const nonRaw = supportedTypes?.nonRaw || [];
        const raw = supportedTypes?.raw || [];
        const allImageExtensions = [...nonRaw, ...raw];

        const selected = await open({
          filters: [
            {
              name: 'All Supported Images',
              extensions: allImageExtensions,
            },
            {
              name: 'RAW Images',
              extensions: raw,
            },
            {
              name: 'Standard Images (JPEG, PNG, etc.)',
              extensions: nonRaw,
            },
            {
              name: 'All Files',
              extensions: ['*'],
            },
          ],
          multiple: true,
          title: 'Select files to import',
        });

        if (Array.isArray(selected) && selected.length > 0) {
          setImportSourcePaths(selected);
          setImportTargetFolder(targetPath);
          setIsImportModalOpen(true);
        }
      } catch (err) {
        console.error('Failed to open file dialog for import:', err);
      }
    },
    [supportedTypes],
  );

  const handleEditorContextMenu = (event: any) => {
    event.preventDefault();
    event.stopPropagation();
    const options: Array<Option> = [
      { label: 'Undo', icon: Undo, onClick: undo, disabled: !canUndo },
      { label: 'Redo', icon: Redo, onClick: redo, disabled: !canRedo },
      { type: OPTION_SEPARATOR },
      { label: 'Copy Adjustments', icon: Copy, onClick: handleCopyAdjustments },
      {
        label: 'Paste Adjustments',
        icon: ClipboardPaste,
        onClick: handlePasteAdjustments,
        disabled: copiedAdjustments === null,
      },
      { type: OPTION_SEPARATOR },
      { label: 'Auto Adjust', icon: Aperture, onClick: handleAutoAdjustments },
      {
        label: 'Set Rating',
        icon: Star,
        submenu: [0, 1, 2, 3, 4, 5].map((rating: number) => ({
          label: rating === 0 ? 'No Rating' : `${rating} Star${rating !== 1 ? 's' : ''}`,
          onClick: () => handleRate(rating),
        })),
      },
      {
        label: 'Set Color Label',
        icon: Tag,
        submenu: [
          { label: 'No Label', onClick: () => handleSetColorLabel(null) },
          ...COLOR_LABELS.map((label: Color) => ({
            label: label.name.charAt(0).toUpperCase() + label.name.slice(1),
            color: label.color,
            onClick: () => handleSetColorLabel(label.name),
          })),
        ],
      },
      { type: OPTION_SEPARATOR },
      {
        label: 'Reset Adjustments',
        icon: RotateCcw,
        onClick: () => {
          debouncedSetHistory.cancel();
          const currentRating = adjustments.rating;
          resetAdjustmentsHistory({ ...INITIAL_ADJUSTMENTS, rating: currentRating, aiPatches: [] });
        },
      },
    ];
    showContextMenu(event.clientX, event.clientY, options);
  };

  const handleThumbnailContextMenu = (event: any, path: string) => {
    event.preventDefault();
    event.stopPropagation();

    const isTargetInSelection = multiSelectedPaths.includes(path);
    let finalSelection;

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
    const pasteLabel = isSingleSelection ? 'Paste Adjustments' : `Paste Adjustments to ${selectionCount} Images`;
    const resetLabel = isSingleSelection ? 'Reset Adjustments' : `Reset Adjustments on ${selectionCount} Images`;
    const deleteLabel = isSingleSelection ? 'Delete Image' : `Delete ${selectionCount} Images`;
    const copyLabel = isSingleSelection ? 'Copy Image' : `Copy ${selectionCount} Images`;
    const autoAdjustLabel = isSingleSelection ? 'Auto Adjust Image' : `Auto Adjust ${selectionCount} Images`;
    const renameLabel = isSingleSelection ? 'Rename Image' : `Rename ${selectionCount} Images`;

    const handleApplyAutoAdjustmentsToSelection = () => {
      if (finalSelection.length === 0) {
        return;
      }

      invoke(Invokes.ApplyAutoAdjustmentsToPaths, { paths: finalSelection })
        .then(async () => {
          if (selectedImage && finalSelection.includes(selectedImage.path)) {
            const metadata: Metadata = await invoke(Invokes.LoadMetadata, { path: selectedImage.path });

            if (metadata.adjustments && !metadata.adjustments.is_null) {
              const normalized = normalizeLoadedAdjustments(metadata.adjustments);
              setLiveAdjustments(normalized);
              resetAdjustmentsHistory(normalized);
            }
          }
          if (libraryActivePath && finalSelection.includes(libraryActivePath)) {
            const metadata: Metadata = await invoke(Invokes.LoadMetadata, { path: libraryActivePath });

            if (metadata.adjustments && !metadata.adjustments.is_null) {
              const normalized = normalizeLoadedAdjustments(metadata.adjustments);
              setLibraryActiveAdjustments(normalized);
            }
          }
        })
        .catch((err) => {
          console.error('Failed to apply auto adjustments to paths:', err);
          setError(`Failed to apply auto adjustments: ${err}`);
        });
    };

    const options = [
      ...(!isEditingThisImage
        ? [
            {
              disabled: !isSingleSelection,
              icon: Edit,
              label: 'Edit Photo',
              onClick: () => handleImageSelect(finalSelection[0]),
            },
            { type: OPTION_SEPARATOR },
          ]
        : []),
      {
        disabled: !isSingleSelection,
        icon: Copy,
        label: 'Copy Adjustments',
        onClick: async () => {
          try {
            const metadata: any = await invoke(Invokes.LoadMetadata, { path: finalSelection[0] });
            const sourceAdjustments =
              metadata.adjustments && !metadata.adjustments.is_null
                ? { ...INITIAL_ADJUSTMENTS, ...metadata.adjustments }
                : INITIAL_ADJUSTMENTS;
            const adjustmentsToCopy: any = {};
            for (const key of COPYABLE_ADJUSTMENT_KEYS) {
              if (sourceAdjustments.hasOwnProperty(key)) adjustmentsToCopy[key] = sourceAdjustments[key];
            }
            setCopiedAdjustments(adjustmentsToCopy);
            setIsCopied(true);
          } catch (err) {
            console.error('Failed to load metadata for copy:', err);
            setError(`Failed to copy adjustments: ${err}`);
          }
        },
      },
      {
        disabled: copiedAdjustments === null,
        icon: ClipboardPaste,
        label: pasteLabel,
        onClick: handlePasteAdjustments,
      },
      { label: autoAdjustLabel, icon: Aperture, onClick: handleApplyAutoAdjustmentsToSelection },
      {
        disabled: selectionCount < 2,
        icon: Images,
        label: isSingleSelection ? 'Stitch Image' : `Stitch ${selectionCount} Images`,
        onClick: () => {
          setPanoramaModalState({
            error: null,
            finalImageBase64: null,
            isOpen: true,
            progressMessage: 'Starting panorama process...',
            stitchingSourcePaths: finalSelection,
          });
          invoke(Invokes.StitchPanorama, { paths: finalSelection }).catch((err) => {
            setPanoramaModalState((prev: PanoramaModalState) => ({
              ...prev,
              error: String(err),
              isOpen: true,
              progressMessage: 'Failed to start.',
            }));
          });
        },
      },
      { type: OPTION_SEPARATOR },
      {
        label: copyLabel,
        icon: Copy,
        onClick: () => {
          setCopiedFilePaths(finalSelection);
          setIsCopied(true);
        },
      },
      {
        disabled: !isSingleSelection,
        icon: CopyPlus,
        label: 'Duplicate Image',
        onClick: async () => {
          try {
            await invoke(Invokes.DuplicateFile, { path: finalSelection[0] });
            handleLibraryRefresh();
          } catch (err) {
            console.error('Failed to duplicate file:', err);
            setError(`Failed to duplicate file: ${err}`);
          }
        },
      },
      { icon: FileEdit, label: renameLabel, onClick: () => handleRenameFiles(finalSelection) },
      { type: OPTION_SEPARATOR },
      {
        icon: Star,
        label: 'Set Rating',
        submenu: [0, 1, 2, 3, 4, 5].map((rating: number) => ({
          label: rating === 0 ? 'No Rating' : `${rating} Star${rating !== 1 ? 's' : ''}`,
          onClick: () => handleRate(rating, finalSelection),
        })),
      },
      {
        label: 'Set Color Label',
        icon: Tag,
        submenu: [
          { label: 'No Label', onClick: () => handleSetColorLabel(null, finalSelection) },
          ...COLOR_LABELS.map((label: Color) => ({
            label: label.name.charAt(0).toUpperCase() + label.name.slice(1),
            color: label.color,
            onClick: () => handleSetColorLabel(label.name, finalSelection),
          })),
        ],
      },
      { type: OPTION_SEPARATOR },
      {
        disabled: !isSingleSelection,
        icon: Folder,
        label: 'Show in File Explorer',
        onClick: () => {
          invoke(Invokes.ShowInFinder, { path: finalSelection[0] }).catch((err) =>
            setError(`Could not show file in explorer: ${err}`),
          );
        },
      },
      { label: resetLabel, icon: RotateCcw, onClick: () => handleResetAdjustments(finalSelection) },
      {
        label: deleteLabel,
        icon: Trash2,
        isDestructive: true,
        submenu: [
          { label: 'Cancel', icon: X, onClick: () => {} },
          {
            label: 'Delete Selected Only',
            icon: Check,
            isDestructive: true,
            onClick: () => executeDelete(finalSelection, { includeAssociated: false }),
          },
          {
            label: 'Delete + Associated (RAW/JPEG)',
            icon: Check,
            isDestructive: true,
            onClick: () => executeDelete(finalSelection, { includeAssociated: true }),
          },
        ],
      },
    ];
    showContextMenu(event.clientX, event.clientY, options);
  };

  const handleCreateFolder = async (folderName: string) => {
    if (folderName && folderName.trim() !== '' && folderActionTarget) {
      try {
        await invoke(Invokes.CreateFolder, { path: `${folderActionTarget}/${folderName.trim()}` });
        handleRefreshFolderTree();
      } catch (err) {
        setError(`Failed to create folder: ${err}`);
      }
    }
  };

  const handleRenameFolder = async (newName: string) => {
    if (newName && newName.trim() !== '' && folderActionTarget) {
      try {
        await invoke(Invokes.RenameFolder, { path: folderActionTarget, newName: newName.trim() });
        if (rootPath === folderActionTarget) {
          const newRootPath = folderActionTarget.substring(0, folderActionTarget.lastIndexOf('/') + 1) + newName.trim();
          setRootPath(newRootPath);
          handleSettingsChange({ ...appSettings, lastRootPath: newRootPath } as AppSettings);
        }
        if (currentFolderPath?.startsWith(folderActionTarget)) {
          const newCurrentPath = currentFolderPath.replace(
            folderActionTarget,
            folderActionTarget.substring(0, folderActionTarget.lastIndexOf('/') + 1) + newName.trim(),
          );
          setCurrentFolderPath(newCurrentPath);
        }
        handleRefreshFolderTree();
      } catch (err) {
        setError(`Failed to rename folder: ${err}`);
      }
    }
  };

  const handleFolderTreeContextMenu = (event: any, path: string) => {
    event.preventDefault();
    event.stopPropagation();
    const targetPath = path || rootPath;
    if (!targetPath) {
      return;
    }
    const isRoot = targetPath === rootPath;
    const numCopied = copiedFilePaths.length;
    const copyPastedLabel = numCopied === 1 ? 'Copy image here' : `Copy ${numCopied} images here`;
    const movePastedLabel = numCopied === 1 ? 'Move image here' : `Move ${numCopied} images here`;
    const options = [
      {
        icon: FolderPlus,
        label: 'New Folder',
        onClick: () => {
          setFolderActionTarget(targetPath);
          setIsCreateFolderModalOpen(true);
        },
      },
      {
        disabled: isRoot,
        icon: FileEdit,
        label: 'Rename Folder',
        onClick: () => {
          setFolderActionTarget(targetPath);
          setIsRenameFolderModalOpen(true);
        },
      },
      { type: OPTION_SEPARATOR },
      {
        disabled: copiedFilePaths.length === 0,
        icon: ClipboardPaste,
        label: 'Paste',
        submenu: [
          {
            label: copyPastedLabel,
            onClick: async () => {
              try {
                await invoke(Invokes.CopyFiles, { sourcePaths: copiedFilePaths, destinationFolder: targetPath });
                if (targetPath === currentFolderPath) handleLibraryRefresh();
              } catch (err) {
                setError(`Failed to copy files: ${err}`);
              }
            },
          },
          {
            label: movePastedLabel,
            onClick: async () => {
              try {
                await invoke(Invokes.MoveFiles, { sourcePaths: copiedFilePaths, destinationFolder: targetPath });
                setCopiedFilePaths([]);
                setMultiSelectedPaths([]);
                handleRefreshFolderTree();
                handleLibraryRefresh();
              } catch (err) {
                setError(`Failed to move files: ${err}`);
              }
            },
          },
        ],
      },
      { icon: FolderInput, label: 'Import Images', onClick: () => handleImportClick(targetPath) },
      { type: OPTION_SEPARATOR },
      {
        icon: Folder,
        label: 'Show in File Explorer',
        onClick: () =>
          invoke(Invokes.ShowInFinder, { path: targetPath }).catch((err) => setError(`Could not show folder: ${err}`)),
      },
      ...(path
        ? [
            {
              disabled: isRoot,
              icon: Trash2,
              isDestructive: true,
              label: 'Delete Folder',
              submenu: [
                { label: 'Cancel', icon: X, onClick: () => {} },
                {
                  label: 'Confirm',
                  icon: Check,
                  isDestructive: true,
                  onClick: async () => {
                    try {
                      await invoke(Invokes.DeleteFolder, { path: targetPath });
                      if (currentFolderPath?.startsWith(targetPath)) await handleSelectSubfolder(rootPath);
                      handleRefreshFolderTree();
                    } catch (err) {
                      setError(`Failed to delete folder: ${err}`);
                    }
                  },
                },
              ],
            },
          ]
        : []),
    ];
    showContextMenu(event.clientX, event.clientY, options);
  };

  const handleMainLibraryContextMenu = (event: any) => {
    event.preventDefault();
    event.stopPropagation();
    const numCopied = copiedFilePaths.length;
    const copyPastedLabel = numCopied === 1 ? 'Copy image here' : `Copy ${numCopied} images here`;
    const movePastedLabel = numCopied === 1 ? 'Move image here' : `Move ${numCopied} images here`;
    const options = [
      {
        label: 'Paste',
        icon: ClipboardPaste,
        disabled: copiedFilePaths.length === 0,
        submenu: [
          {
            label: copyPastedLabel,
            onClick: async () => {
              try {
                await invoke(Invokes.CopyFiles, { sourcePaths: copiedFilePaths, destinationFolder: currentFolderPath });
                handleLibraryRefresh();
              } catch (err) {
                setError(`Failed to copy files: ${err}`);
              }
            },
          },
          {
            label: movePastedLabel,
            onClick: async () => {
              try {
                await invoke(Invokes.MoveFiles, { sourcePaths: copiedFilePaths, destinationFolder: currentFolderPath });
                setCopiedFilePaths([]);
                setMultiSelectedPaths([]);
                handleRefreshFolderTree();
                handleLibraryRefresh();
              } catch (err) {
                setError(`Failed to move files: ${err}`);
              }
            },
          },
        ],
      },
    ];
    showContextMenu(event.clientX, event.clientY, options);
  };

  const renderMainView = () => {
    const panelVariants: any = {
      animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'circOut' } },
      exit: { opacity: 0.4, y: -20, transition: { duration: 0.1, ease: 'circIn' } },
      initial: { opacity: 0.4, y: 20 },
    };

    if (selectedImage) {
      return (
        <div className="flex flex-row flex-grow h-full min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
            <Editor
              activeAiPatchContainerId={activeAiPatchContainerId}
              activeAiSubMaskId={activeAiSubMaskId}
              activeMaskContainerId={activeMaskContainerId}
              activeMaskId={activeMaskId}
              activeRightPanel={activeRightPanel}
              adjustments={adjustments}
              brushSettings={brushSettings}
              canRedo={canRedo}
              canUndo={canUndo}
              finalPreviewUrl={finalPreviewUrl}
              fullScreenUrl={fullScreenUrl}
              isAdjusting={isAdjusting}
              isFullScreen={isFullScreen}
              isFullScreenLoading={isFullScreenLoading}
              isLoading={isViewLoading}
              isMaskControlHovered={isMaskControlHovered}
              isStraightenActive={isStraightenActive}
              isWaveformVisible={isWaveformVisible}
              onBackToLibrary={handleBackToLibrary}
              onCloseWaveform={() => setIsWaveformVisible(false)}
              onContextMenu={handleEditorContextMenu}
              onGenerateAiMask={handleGenerateAiMask}
              onQuickErase={handleQuickErase}
              onRedo={redo}
              onSelectAiSubMask={setActiveAiSubMaskId}
              onSelectMask={setActiveMaskId}
              onStraighten={handleStraighten}
              onToggleFullScreen={handleToggleFullScreen}
              onToggleWaveform={handleToggleWaveform}
              onUndo={undo}
              onZoomed={handleUserTransform}
              renderedRightPanel={renderedRightPanel}
              selectedImage={selectedImage}
              setAdjustments={setAdjustments}
              setShowOriginal={setShowOriginal}
              showOriginal={showOriginal}
              targetZoom={zoom}
              thumbnails={thumbnails}
              transformWrapperRef={transformWrapperRef}
              uncroppedAdjustedPreviewUrl={uncroppedAdjustedPreviewUrl}
              updateSubMask={updateSubMask}
              waveform={waveform}
              onDisplaySizeChange={handleDisplaySizeChange}
              onInitialFitScale={setInitialFitScale}
              onZoomChange={handleZoomChange}
              originalSize={originalSize}
              baseRenderSize={baseRenderSize}
              isFullResolution={isFullResolution}
              fullResolutionUrl={fullResolutionUrl}
              isLoadingFullRes={isLoadingFullRes}
            />
            <Resizer
              direction={Orientation.Horizontal}
              onMouseDown={createResizeHandler(setBottomPanelHeight, bottomPanelHeight)}
            />
            <BottomBar
              filmstripHeight={bottomPanelHeight}
              imageList={sortedImageList}
              imageRatings={imageRatings}
              isCopied={isCopied}
              isCopyDisabled={!selectedImage}
              isFilmstripVisible={uiVisibility.filmstrip}
              isLoading={isViewLoading}
              isPasted={isPasted}
              isPasteDisabled={copiedAdjustments === null}
              isRatingDisabled={!selectedImage}
              isResizing={isResizing}
              multiSelectedPaths={multiSelectedPaths}
              displaySize={displaySize}
              originalSize={originalSize}
              baseRenderSize={baseRenderSize}
              onClearSelection={handleClearSelection}
              onContextMenu={handleThumbnailContextMenu}
              onCopy={handleCopyAdjustments}
              onImageSelect={handleImageClick}
              onPaste={() => handlePasteAdjustments()}
              onRate={handleRate}
              onZoomChange={handleZoomChange}
              rating={adjustments.rating || 0}
              selectedImage={selectedImage}
              setIsFilmstripVisible={(value: boolean) =>
                setUiVisibility((prev: UiVisibility) => ({ ...prev, filmstrip: value }))
              }
              thumbnailAspectRatio={thumbnailAspectRatio}
              thumbnails={thumbnails}
              zoom={zoom}
            />
          </div>

          <Resizer
            onMouseDown={createResizeHandler(setRightPanelWidth, rightPanelWidth)}
            direction={Orientation.Vertical}
          />
          <div className="flex bg-bg-secondary rounded-lg h-full">
            <div
              className={clsx('h-full overflow-hidden', !isResizing && 'transition-all duration-300 ease-in-out')}
              style={{ width: activeRightPanel ? `${rightPanelWidth}px` : '0px' }}
            >
              <div style={{ width: `${rightPanelWidth}px` }} className="h-full">
                <AnimatePresence mode="wait">
                  {activeRightPanel && (
                    <motion.div
                      animate="animate"
                      className="h-full w-full"
                      exit="exit"
                      initial="initial"
                      key={renderedRightPanel}
                      variants={panelVariants}
                    >
                      {renderedRightPanel === Panel.Adjustments && (
                        <Controls
                          adjustments={adjustments}
                          collapsibleState={collapsibleSectionsState}
                          copiedSectionAdjustments={copiedSectionAdjustments}
                          handleAutoAdjustments={handleAutoAdjustments}
                          histogram={histogram}
                          selectedImage={selectedImage}
                          setAdjustments={setAdjustments}
                          setCollapsibleState={setCollapsibleSectionsState}
                          setCopiedSectionAdjustments={setCopiedSectionAdjustments}
                          theme={theme}
                        />
                      )}
                      {renderedRightPanel === Panel.Metadata && <MetadataPanel selectedImage={selectedImage} />}
                      {renderedRightPanel === Panel.Crop && (
                        <CropPanel
                          adjustments={adjustments}
                          isStraightenActive={isStraightenActive}
                          selectedImage={selectedImage}
                          setAdjustments={setAdjustments}
                          setIsStraightenActive={setIsStraightenActive}
                        />
                      )}
                      {renderedRightPanel === Panel.Masks && (
                        <MasksPanel
                          activeMaskContainerId={activeMaskContainerId}
                          activeMaskId={activeMaskId}
                          adjustments={adjustments}
                          aiModelDownloadStatus={aiModelDownloadStatus}
                          brushSettings={brushSettings}
                          copiedMask={copiedMask}
                          histogram={histogram}
                          isGeneratingAiMask={isGeneratingAiMask}
                          onGenerateAiForegroundMask={handleGenerateAiForegroundMask}
                          onSelectContainer={setActiveMaskContainerId}
                          onSelectMask={setActiveMaskId}
                          selectedImage={selectedImage}
                          setAdjustments={setAdjustments}
                          setBrushSettings={setBrushSettings}
                          setCopiedMask={setCopiedMask}
                          setCustomEscapeHandler={setCustomEscapeHandler}
                          setIsMaskControlHovered={setIsMaskControlHovered}
                        />
                      )}
                      {renderedRightPanel === Panel.Presets && (
                        <PresetsPanel
                          activePanel={activeRightPanel}
                          adjustments={adjustments}
                          selectedImage={selectedImage}
                          setAdjustments={setAdjustments}
                        />
                      )}
                      {renderedRightPanel === Panel.Export && (
                        <ExportPanel
                          adjustments={adjustments}
                          exportState={exportState}
                          multiSelectedPaths={multiSelectedPaths}
                          selectedImage={selectedImage}
                          setExportState={setExportState}
                        />
                      )}
                      {renderedRightPanel === Panel.Ai && (
                        <AIPanel
                          activePatchContainerId={activeAiPatchContainerId}
                          activeSubMaskId={activeAiSubMaskId}
                          adjustments={adjustments}
                          aiModelDownloadStatus={aiModelDownloadStatus}
                          brushSettings={brushSettings}
                          isComfyUiConnected={isComfyUiConnected}
                          isGeneratingAi={isGeneratingAi}
                          isGeneratingAiMask={isGeneratingAiMask}
                          onDeletePatch={handleDeleteAiPatch}
                          onGenerateAiForegroundMask={handleGenerateAiForegroundMask}
                          onGenerativeReplace={handleGenerativeReplace}
                          onSelectPatchContainer={setActiveAiPatchContainerId}
                          onSelectSubMask={setActiveAiSubMaskId}
                          onTogglePatchVisibility={handleToggleAiPatchVisibility}
                          selectedImage={selectedImage}
                          setAdjustments={setAdjustments}
                          setBrushSettings={setBrushSettings}
                          setCustomEscapeHandler={setCustomEscapeHandler}
                        />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div
              className={clsx(
                'h-full border-l transition-colors',
                activeRightPanel ? 'border-surface' : 'border-transparent',
              )}
            >
              <RightPanelSwitcher activePanel={activeRightPanel} onPanelSelect={handleRightPanelSelect} />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-row flex-grow h-full min-h-0">
        <div className="flex-1 flex flex-col min-w-0 gap-2">
          <MainLibrary
            activePath={libraryActivePath}
            aiModelDownloadStatus={aiModelDownloadStatus}
            appSettings={appSettings}
            currentFolderPath={currentFolderPath}
            filterCriteria={filterCriteria}
            imageList={sortedImageList}
            imageRatings={imageRatings}
            importState={importState}
            indexingProgress={indexingProgress}
            isIndexing={isIndexing}
            isLoading={isViewLoading}
            isTreeLoading={isTreeLoading}
            multiSelectedPaths={multiSelectedPaths}
            onClearSelection={handleClearSelection}
            onContextMenu={handleThumbnailContextMenu}
            onContinueSession={handleContinueSession}
            onEmptyAreaContextMenu={handleMainLibraryContextMenu}
            onGoHome={handleGoHome}
            onImageClick={handleLibraryImageSingleClick}
            onImageDoubleClick={handleImageSelect}
            onLibraryRefresh={handleLibraryRefresh}
            onOpenFolder={handleOpenFolder}
            onSettingsChange={handleSettingsChange}
            onThumbnailSizeChange={setThumbnailSize}
            onThumbnailAspectRatioChange={setThumbnailAspectRatio}
            rootPath={rootPath}
            searchQuery={searchQuery}
            setFilterCriteria={setFilterCriteria}
            setSearchQuery={setSearchQuery}
            setSortCriteria={setSortCriteria}
            sortCriteria={sortCriteria}
            theme={theme}
            thumbnails={thumbnails}
            thumbnailSize={thumbnailSize}
            thumbnailAspectRatio={thumbnailAspectRatio}
          />
          {rootPath && (
            <BottomBar
              isCopied={isCopied}
              isCopyDisabled={multiSelectedPaths.length !== 1}
              isExportDisabled={multiSelectedPaths.length === 0}
              isLibraryView={true}
              isPasted={isPasted}
              isPasteDisabled={copiedAdjustments === null || multiSelectedPaths.length === 0}
              isRatingDisabled={multiSelectedPaths.length === 0}
              isResetDisabled={multiSelectedPaths.length === 0}
              onCopy={handleCopyAdjustments}
              onExportClick={() => setIsLibraryExportPanelVisible((prev) => !prev)}
              onPaste={() => handlePasteAdjustments()}
              onRate={handleRate}
              onReset={() => handleResetAdjustments()}
              rating={libraryActiveAdjustments.rating || 0}
              thumbnailAspectRatio={thumbnailAspectRatio}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-bg-primary font-sans text-text-primary overflow-hidden select-none">
      {appSettings?.decorations || (!isWindowFullScreen && <TitleBar />)}
      <div
        className={clsx('flex-1 flex flex-col min-h-0', [
          rootPath && 'p-2 gap-2',
          !appSettings?.decorations && rootPath && !isWindowFullScreen && 'pt-12',
        ])}
      >
        {error && (
          <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg z-50">
            {error}
            <button onClick={() => setError(null)} className="ml-4 font-bold hover:text-gray-200">
              ×
            </button>
          </div>
        )}
        <div className="flex flex-row flex-grow h-full min-h-0">
          {rootPath && (
            <>
              <FolderTree
                expandedFolders={expandedFolders}
                isLoading={isTreeLoading}
                isResizing={isResizing}
                isVisible={uiVisibility.folderTree}
                onContextMenu={handleFolderTreeContextMenu}
                onFolderSelect={handleSelectSubfolder}
                onToggleFolder={handleToggleFolder}
                selectedPath={currentFolderPath}
                setIsVisible={(value: boolean) =>
                  setUiVisibility((prev: UiVisibility) => ({ ...prev, folderTree: value }))
                }
                style={{ width: uiVisibility.folderTree ? `${leftPanelWidth}px` : '32px' }}
                tree={folderTree}
              />
              <Resizer
                direction={Orientation.Vertical}
                onMouseDown={createResizeHandler(setLeftPanelWidth, leftPanelWidth)}
              />
            </>
          )}
          <div className="flex-1 flex flex-col min-w-0">{renderMainView()}</div>
          {!selectedImage && isLibraryExportPanelVisible && (
            <Resizer
              direction={Orientation.Vertical}
              onMouseDown={createResizeHandler(setRightPanelWidth, rightPanelWidth)}
            />
          )}
          <div
            className={clsx('flex-shrink-0 overflow-hidden', !isResizing && 'transition-all duration-300 ease-in-out')}
            style={{ width: isLibraryExportPanelVisible ? `${rightPanelWidth}px` : '0px' }}
          >
            <LibraryExportPanel
              exportState={exportState}
              isVisible={isLibraryExportPanelVisible}
              multiSelectedPaths={multiSelectedPaths}
              onClose={() => setIsLibraryExportPanelVisible(false)}
              setExportState={setExportState}
            />
          </div>
        </div>
      </div>
      <PanoramaModal
        error={panoramaModalState.error}
        finalImageBase64={panoramaModalState.finalImageBase64}
        isOpen={panoramaModalState.isOpen}
        onClose={() =>
          setPanoramaModalState({
            isOpen: false,
            progressMessage: '',
            finalImageBase64: null,
            error: null,
            stitchingSourcePaths: [],
          })
        }
        onOpenFile={(path: string) => {
          handleImageSelect(path);
        }}
        onSave={handleSavePanorama}
        progressMessage={panoramaModalState.progressMessage}
      />
      <CreateFolderModal
        isOpen={isCreateFolderModalOpen}
        onClose={() => setIsCreateFolderModalOpen(false)}
        onSave={handleCreateFolder}
      />
      <RenameFolderModal
        currentName={folderActionTarget ? folderActionTarget.split(/[\\/]/).pop() : ''}
        isOpen={isRenameFolderModalOpen}
        onClose={() => setIsRenameFolderModalOpen(false)}
        onSave={handleRenameFolder}
      />
      <RenameFileModal
        filesToRename={renameTargetPaths}
        isOpen={isRenameFileModalOpen}
        onClose={() => setIsRenameFileModalOpen(false)}
        onSave={handleSaveRename}
      />
      <ConfirmModal {...confirmModalState} onClose={closeConfirmModal} />
      <ImportSettingsModal
        fileCount={importSourcePaths.length}
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSave={handleStartImport}
      />
    </div>
  );
}

const AppWrapper = () => (
  <ContextMenuProvider>
    <App />
  </ContextMenuProvider>
);

export default AppWrapper;