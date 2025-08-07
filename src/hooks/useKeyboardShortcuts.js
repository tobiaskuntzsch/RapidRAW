import { useEffect } from 'react';

export const useKeyboardShortcuts = ({
  selectedImage,
  isViewLoading,
  sortedImageList,
  multiSelectedPaths,
  libraryActivePath,
  zoom,
  displaySize,
  baseRenderSize,
  originalSize,
  canUndo,
  canRedo,
  activeRightPanel,
  isFullScreen,
  activeMaskId,
  activeAiSubMaskId,
  activeAiPatchContainerId,
  customEscapeHandler,
  copiedFilePaths,
  isStraightenActive,
  setIsStraightenActive,
  handleImageSelect,
  setLibraryActivePath,
  setMultiSelectedPaths,
  handleRate,
  handleSetColorLabel,
  handleDeleteSelected,
  handleCopyAdjustments,
  handlePasteAdjustments,
  handlePasteFiles,
  setCopiedFilePaths,
  undo,
  redo,
  handleBackToLibrary,
  handleToggleFullScreen,
  setShowOriginal,
  handleRightPanelSelect,
  setIsWaveformVisible,
  handleZoomChange,
  setActiveMaskId,
  setActiveAiSubMaskId,
  onSelectPatchContainer,
}) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      const isInputFocused = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA';
      if (isInputFocused) return;
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
          } else if (activeAiPatchContainerId) {
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
            const currentPercent = originalSize.width > 0 && displaySize.width > 0 
                ? Math.round((displaySize.width / originalSize.width) * 100)
                : 100;
            
            // Toggle between fit-to-window, 100%, and 200%
            let fitPercent = 100;
            if (originalSize.width > 0 && originalSize.height > 0 && baseRenderSize.width > 0 && baseRenderSize.height > 0) {
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
        if (key === 'f' && !isCtrl) { event.preventDefault(); handleToggleFullScreen(); }
        if (key === 'b' && !isCtrl) { event.preventDefault(); setShowOriginal(prev => !prev); }
        if (key === 'r' && !isCtrl) { event.preventDefault(); handleRightPanelSelect('crop'); }
        if (key === 'm' && !isCtrl) { event.preventDefault(); handleRightPanelSelect('masks'); }
        if (key === 'k' && !isCtrl) { event.preventDefault(); handleRightPanelSelect('ai'); }
        if (key === 'i' && !isCtrl) { event.preventDefault(); handleRightPanelSelect('metadata'); }
        if (key === 'e' && !isCtrl) { event.preventDefault(); handleRightPanelSelect('export'); }
        if (key === 'w' && !isCtrl) { event.preventDefault(); setIsWaveformVisible(prev => !prev); }
      }

      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        if (isViewLoading) { event.preventDefault(); return; }
        event.preventDefault();

        if (selectedImage) {
            if (key === 'arrowup' || key === 'arrowdown') {
                // Calculate current zoom percentage relative to original
                const currentPercent = originalSize.width > 0 && displaySize.width > 0 
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
                const currentIndex = sortedImageList.findIndex(img => img.path === selectedImage.path);
                if (currentIndex === -1) return;
                let nextIndex = isNext ? currentIndex + 1 : currentIndex - 1;
                if (nextIndex >= sortedImageList.length) nextIndex = 0;
                if (nextIndex < 0) nextIndex = sortedImageList.length - 1;
                const nextImage = sortedImageList[nextIndex];
                if (nextImage) handleImageSelect(nextImage.path);
            }
        } else {
            const isNext = key === 'arrowright' || key === 'arrowdown';
            const activePath = libraryActivePath;
            if (!activePath || sortedImageList.length === 0) return;
            const currentIndex = sortedImageList.findIndex(img => img.path === activePath);
            if (currentIndex === -1) return;
            let nextIndex = isNext ? currentIndex + 1 : currentIndex - 1;
            if (nextIndex >= sortedImageList.length) nextIndex = 0;
            if (nextIndex < 0) nextIndex = sortedImageList.length - 1;
            const nextImage = sortedImageList[nextIndex];
            if (nextImage) {
                setLibraryActivePath(nextImage.path);
                setMultiSelectedPaths([nextImage.path]);
            }
        }
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
      
      if (key === 'delete') { event.preventDefault(); handleDeleteSelected(); }

      if (isCtrl) {
        switch (key) {
          case 'c': event.preventDefault(); if (event.shiftKey) { if (multiSelectedPaths.length > 0) { setCopiedFilePaths(multiSelectedPaths); } } else handleCopyAdjustments(); break;
          case 'v': event.preventDefault(); if (event.shiftKey) handlePasteFiles('copy'); else handlePasteAdjustments(); break;
          case 'a': event.preventDefault(); if (sortedImageList.length > 0) { setMultiSelectedPaths(sortedImageList.map(f => f.path)); if (!selectedImage) setLibraryActivePath(sortedImageList[sortedImageList.length - 1].path); } break;
          case 'z': if (selectedImage) { event.preventDefault(); undo(); } break;
          case 'y': if (selectedImage) { event.preventDefault(); redo(); } break;
          default: break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [ sortedImageList, selectedImage, undo, redo, isFullScreen, handleToggleFullScreen, handleBackToLibrary, handleRightPanelSelect, handleRate, handleSetColorLabel, handleDeleteSelected, handleCopyAdjustments, handlePasteAdjustments, multiSelectedPaths, copiedFilePaths, handlePasteFiles, libraryActivePath, handleImageSelect, zoom, handleZoomChange, customEscapeHandler, activeMaskId, activeAiSubMaskId, activeAiPatchContainerId, isViewLoading, activeRightPanel, canRedo, canUndo, isStraightenActive, setIsStraightenActive, setActiveMaskId, setActiveAiSubMaskId, onSelectPatchContainer, setCopiedFilePaths, setIsWaveformVisible, setLibraryActivePath, setMultiSelectedPaths, setShowOriginal ]);
};