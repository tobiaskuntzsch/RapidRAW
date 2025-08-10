import { useEffect } from 'react';
import { ImageFile, Panel, SelectedImage } from '../components/ui/AppProperties';

interface KeyboardShortcutsProps {
  activeAiPatchContainerId?: string | null;
  activeAiSubMaskId: string | null;
  activeMaskId: string | null;
  activeRightPanel: Panel | null;
  canRedo: boolean;
  canUndo: boolean;
  copiedFilePaths: Array<string>;
  customEscapeHandler: any;
  handleBackToLibrary(): void;
  handleCopyAdjustments(): void;
  handleDeleteSelected(): void;
  handleImageSelect(path: string): void;
  handlePasteAdjustments(): void;
  handlePasteFiles(str: string): void;
  handleRate(rate: number): void;
  handleRightPanelSelect(panel: Panel): void;
  handleSetColorLabel(label: string | null): void;
  handleToggleFullScreen(): void;
  handleZoomChange(zoom: number | string): void;
  isFullScreen: boolean;
  isStraightenActive: boolean;
  isViewLoading: boolean;
  libraryActivePath: string | null;
  multiSelectedPaths: Array<string>;
  onSelectPatchContainer?(container: string | null): void;
  redo(): void;
  selectedImage: SelectedImage | null;
  setActiveAiSubMaskId(id: string | null): void;
  setActiveMaskId(id: string | null): void;
  setCopiedFilePaths(paths: Array<string>): void;
  setIsStraightenActive(active: any): void;
  setIsWaveformVisible(visible: any): void;
  setLibraryActivePath(path: string): void;
  setMultiSelectedPaths(paths: Array<string>): void;
  setShowOriginal(show: any): void;
  sortedImageList: Array<ImageFile>;
  undo(): void;
  zoom: number;
  displaySize?: { width: number; height: number };
  baseRenderSize?: { width: number; height: number };
  originalSize?: { width: number; height: number };
}

export const useKeyboardShortcuts = ({
  activeAiPatchContainerId,
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
  onSelectPatchContainer,
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
}: KeyboardShortcutsProps) => {
  useEffect(() => {
    const handleKeyDown = (event: any) => {
      const isInputFocused =
        document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';
      if (isInputFocused) {
        return;
      }
      const isCtrl = event.ctrlKey || event.metaKey;
      const isShift = event.shiftKey;
      const key = event.key.toLowerCase();
      const code = event.code;

      if (selectedImage) {
        if (key === 'escape') {
          event.preventDefault();
          if (isStraightenActive) {
            setIsStraightenActive(false);
          } else if (customEscapeHandler) {
            customEscapeHandler();
          } else if (activeAiSubMaskId) {
            setActiveAiSubMaskId(null);
          } else if (activeAiPatchContainerId && onSelectPatchContainer) {
            onSelectPatchContainer(null);
          } else if (activeMaskId) {
            setActiveMaskId(null);
          } else if (isFullScreen) {
            handleToggleFullScreen();
          } else {
            handleBackToLibrary();
          }
          return;
        }
        if (key === ' ' && !isCtrl) {
          event.preventDefault();
          
          // Calculate current zoom percentage relative to original
          const currentPercent = originalSize && originalSize.width > 0 && displaySize && displaySize.width > 0 
            ? Math.round((displaySize.width / originalSize.width) * 100)
            : 100;
          
          // Toggle between fit-to-window, 100%, and 200%
          let fitPercent = 100;
          if (originalSize && originalSize.width > 0 && originalSize.height > 0 && baseRenderSize && baseRenderSize.width > 0 && baseRenderSize.height > 0) {
            const originalAspect = originalSize.width / originalSize.height;
            const baseAspect = baseRenderSize.width / baseRenderSize.height;
            
            if (originalAspect > baseAspect) {
              // Width is limiting (landscape)
              fitPercent = Math.round((baseRenderSize.width / originalSize.width) * 100);
            } else {
              // Height is limiting (portrait)
              fitPercent = Math.round((baseRenderSize.height / originalSize.height) * 100);
            }
          }
          
          if (Math.abs(currentPercent - fitPercent) < 5) {
            handleZoomChange(1.0);
          } else if (Math.abs(currentPercent - 100) < 5) {
            handleZoomChange(2.0);
          } else {
            handleZoomChange('fit-to-window');
          }
          return;
        }
        if (key === 'f' && !isCtrl) {
          event.preventDefault();
          handleToggleFullScreen();
        }
        if (key === 'b' && !isCtrl) {
          event.preventDefault();
          setShowOriginal((prev: boolean) => !prev);
        }
        if (key === 'r' && !isCtrl) {
          event.preventDefault();
          handleRightPanelSelect(Panel.Crop);
        }
        if (key === 'm' && !isCtrl) {
          event.preventDefault();
          handleRightPanelSelect(Panel.Masks);
        }
        if (key === 'k' && !isCtrl) {
          event.preventDefault();
          handleRightPanelSelect(Panel.Ai);
        }
        if (key === 'i' && !isCtrl) {
          event.preventDefault();
          handleRightPanelSelect(Panel.Metadata);
        }
        if (key === 'e' && !isCtrl) {
          event.preventDefault();
          handleRightPanelSelect(Panel.Export);
        }
        if (key === 'w' && !isCtrl) {
          event.preventDefault();
          setIsWaveformVisible((prev: boolean) => !prev);
        }
      }

      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        if (isViewLoading) {
          event.preventDefault();
          return;
        }
        event.preventDefault();

        if (selectedImage) {
          if (key === 'arrowup' || key === 'arrowdown') {
            // Calculate current zoom percentage relative to original
            const currentPercent = originalSize && originalSize.width > 0 && displaySize && displaySize.width > 0 
              ? (displaySize.width / originalSize.width)
              : 1.0;
            
            const step = 0.1; // 10% steps
            const newPercent = key === 'arrowup' 
              ? currentPercent + step 
              : currentPercent - step;
            
            // Clamp to 10%-200% of original size
            const clampedPercent = Math.max(0.1, Math.min(newPercent, 2.0));
            handleZoomChange(clampedPercent);
          } else {
            const isNext = key === 'arrowright';
            const currentIndex = sortedImageList.findIndex((img: ImageFile) => img.path === selectedImage.path);
            if (currentIndex === -1) {
              return;
            }
            let nextIndex = isNext ? currentIndex + 1 : currentIndex - 1;
            if (nextIndex >= sortedImageList.length) {
              nextIndex = 0;
            }
            if (nextIndex < 0) {
              nextIndex = sortedImageList.length - 1;
            }
            const nextImage = sortedImageList[nextIndex];
            if (nextImage) {
              handleImageSelect(nextImage.path);
            }
          }
        } else {
          const isNext = key === 'arrowright' || key === 'arrowdown';
          const activePath = libraryActivePath;
          if (!activePath || sortedImageList.length === 0) {
            return;
          }
          const currentIndex = sortedImageList.findIndex((img: ImageFile) => img.path === activePath);
          if (currentIndex === -1) {
            return;
          }
          let nextIndex = isNext ? currentIndex + 1 : currentIndex - 1;
          if (nextIndex >= sortedImageList.length) {
            nextIndex = 0;
          }
          if (nextIndex < 0) {
            nextIndex = sortedImageList.length - 1;
          }
          const nextImage = sortedImageList[nextIndex];
          if (nextImage) {
            setLibraryActivePath(nextImage.path);
            setMultiSelectedPaths([nextImage.path]);
          }
        }
      }

      if (['0', '1', '2', '3', '4', '5'].includes(key) && !isCtrl) {
        event.preventDefault();
        handleRate(parseInt(key, 10));
      }

      if (code.startsWith('Digit') && !isCtrl) {
        event.preventDefault();
        const keyNum = parseInt(code.replace('Digit', ''), 10);

        if (isShift) {
          if (keyNum === 0) {
            handleSetColorLabel(null);
          } else if (keyNum >= 1 && keyNum <= 5) {
            const colors = ['red', 'yellow', 'green', 'blue', 'purple'];
            handleSetColorLabel(colors[keyNum - 1]);
          }
        } else {
          if (keyNum >= 0 && keyNum <= 5) {
            handleRate(keyNum);
          }
        }
      }

      if (key === 'delete') {
        event.preventDefault();
        handleDeleteSelected();
      }

      if (isCtrl) {
        switch (key) {
          case 'c':
            event.preventDefault();
            if (event.shiftKey) {
              if (multiSelectedPaths.length > 0) {
                setCopiedFilePaths(multiSelectedPaths);
              }
            } else {
              handleCopyAdjustments();
            }
            break;
          case 'v':
            event.preventDefault();
            if (event.shiftKey) {
              handlePasteFiles('copy');
            } else {
              handlePasteAdjustments();
            }
            break;
          case 'a':
            event.preventDefault();
            if (sortedImageList.length > 0) {
              setMultiSelectedPaths(sortedImageList.map((f: ImageFile) => f.path));
              if (!selectedImage) {
                setLibraryActivePath(sortedImageList[sortedImageList.length - 1].path);
              }
            }
            break;
          case 'z':
            if (selectedImage) {
              event.preventDefault();
              undo();
            }
            break;
          case 'y':
            if (selectedImage) {
              event.preventDefault();
              redo();
            }
            break;
          default:
            break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    activeAiPatchContainerId,
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
    onSelectPatchContainer,
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
  ]);
};
