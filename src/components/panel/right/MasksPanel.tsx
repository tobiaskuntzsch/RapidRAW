import { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Brush,
  ChevronsRight,
  Circle,
  ClipboardPaste,
  Copy,
  Droplet,
  Edit,
  Eye,
  EyeOff,
  FileEdit,
  PlusSquare,
  RotateCcw,
  Sparkles,
  Trash2,
  TriangleRight,
  User,
} from 'lucide-react';
import MaskControls from './MaskControls';
import {
  Adjustments,
  INITIAL_MASK_ADJUSTMENTS,
  INITIAL_MASK_CONTAINER,
  MaskContainer,
} from '../../../utils/adjustments';
import { useContextMenu } from '../../../context/ContextMenuContext';
import { Mask, MaskType, SubMask } from './Masks';
import { BrushSettings, OPTION_SEPARATOR, SelectedImage } from '../../ui/AppProperties';
import { createSubMask } from '../../../utils/maskUtils';

interface MasksPanelProps {
  activeMaskContainerId: string | null;
  activeMaskId: string | null;
  adjustments: Adjustments;
  aiModelDownloadStatus: string | null;
  brushSettings: BrushSettings | null;
  copiedMask: MaskContainer | null;
  histogram: any;
  isGeneratingAiMask: boolean;
  onGenerateAiForegroundMask(id: string): void;
  onSelectContainer(id: string | null): void;
  onSelectMask(id: string | null): void;
  selectedImage: SelectedImage;
  setAdjustments(adjustments: Partial<Adjustments>): void;
  setBrushSettings(brushSettings: BrushSettings): void;
  setCopiedMask(mask: MaskContainer): void;
  setCustomEscapeHandler(handler: any): void;
  setIsMaskControlHovered(hovered: boolean): void;
}

const itemVariants = {
  hidden: { opacity: 0, x: -15 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, delay: i * 0.05 },
  }),
  exit: { opacity: 0, x: -15, transition: { duration: 0.2 } },
};

export const MASK_PANEL_TYPES: Array<MaskType> = [
  {
    disabled: false,
    icon: Sparkles,
    name: 'Subject',
    type: Mask.AiSubject,
  },
  {
    disabled: false,
    icon: User,
    name: 'Foreground',
    type: Mask.AiForeground,
  },
  {
    disabled: false,
    icon: Brush,
    name: 'Brush',
    type: Mask.Brush,
  },
  {
    disabled: false,
    icon: TriangleRight,
    name: 'Linear',
    type: Mask.Linear,
  },
  {
    disabled: false,
    icon: Circle,
    name: 'Radial',
    type: Mask.Radial,
  },
  {
    disabled: true,
    icon: Droplet,
    name: 'Color',
    type: Mask.Color,
  },
];

export default function MasksPanel({
  activeMaskContainerId,
  activeMaskId,
  adjustments,
  aiModelDownloadStatus,
  brushSettings,
  copiedMask,
  histogram,
  isGeneratingAiMask,
  onGenerateAiForegroundMask,
  onSelectContainer,
  onSelectMask,
  selectedImage,
  setAdjustments,
  setBrushSettings,
  setCopiedMask,
  setCustomEscapeHandler,
  setIsMaskControlHovered,
}: MasksPanelProps) {
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [renamingContainerId, setRenamingContainerId] = useState(null);
  const [tempName, setTempName] = useState('');
  const { showContextMenu } = useContextMenu();
  const isInitialRender = useRef(true);

  const handleBackToList = useCallback(() => {
    onSelectContainer(null);
    onSelectMask(null);
  }, [onSelectContainer, onSelectMask]);

  const handleFinishRename = () => {
    if (renamingContainerId && tempName.trim()) {
      updateContainer(renamingContainerId, { name: tempName.trim() });
    }
    setRenamingContainerId(null);
    setTempName('');
  };

  useEffect(() => {
    const escapeHandler = () => {
      if (renamingContainerId) {
        handleFinishRename();
      } else if (activeMaskContainerId) {
        handleBackToList();
      }
    };

    if (activeMaskContainerId) {
      setCustomEscapeHandler(() => escapeHandler);
    } else {
      setCustomEscapeHandler(null);
    }

    return () => setCustomEscapeHandler(null);
  }, [activeMaskContainerId, renamingContainerId, handleBackToList]);

  useEffect(() => {
    isInitialRender.current = false;
  }, []);

  const handleAddMaskContainer = (type: Mask) => {
    const subMask = createSubMask(type, selectedImage);
    const newContainer = {
      ...INITIAL_MASK_CONTAINER,
      id: uuidv4(),
      name: `Mask ${adjustments.masks.length + 1}`,
      subMasks: [subMask],
    };
    setAdjustments((prev: Partial<Adjustments>) => ({ ...prev, masks: [...(prev.masks || []), newContainer] }));
    onSelectContainer(newContainer.id);
    onSelectMask(subMask.id);
    if (type === Mask.AiForeground) {
      onGenerateAiForegroundMask(subMask.id);
    }
  };

  const handleDeleteContainer = (id: string) => {
    setDeletingItemId(id);
    setTimeout(() => {
      if (activeMaskContainerId === id) onSelectContainer(null);
      const container = adjustments.masks.find((c: MaskContainer) => c.id === id);
      if (container && container.subMasks.some((sm: SubMask) => sm.id === activeMaskId)) {
        onSelectMask(null);
      }
      setAdjustments((prev: Partial<Adjustments>) => ({
        ...prev,
        masks: (prev.masks || []).filter((c: MaskContainer) => c.id !== id),
      }));
      setDeletingItemId(null);
    }, 200);
  };

  const handleToggleContainerVisibility = (id: string) => {
    setAdjustments((prev: Partial<Adjustments>) => ({
      ...prev,
      masks: prev.masks?.map((c: MaskContainer) => (c.id === id ? { ...c, visible: !c.visible } : c)),
    }));
  };

  const updateContainer = (containerId: string, updatedData: any) => {
    setAdjustments((prev: Partial<Adjustments>) => ({
      ...prev,
      masks: (prev.masks || []).map((c: MaskContainer) => (c.id === containerId ? { ...c, ...updatedData } : c)),
    }));
  };

  const updateSubMask = (subMaskId: string, updatedData: any) => {
    setAdjustments((prev: Partial<Adjustments>) => ({
      ...prev,
      masks: prev.masks?.map((c: MaskContainer) => ({
        ...c,
        subMasks: c.subMasks.map((sm: SubMask) => (sm.id === subMaskId ? { ...sm, ...updatedData } : sm)),
      })),
    }));
  };

  const handleResetAllMasks = () => {
    onSelectContainer(null);
    onSelectMask(null);
    setAdjustments((prev: Partial<Adjustments>) => ({ ...prev, masks: [] }));
  };

  const handleOpenContainerForEditing = (container: MaskContainer) => {
    onSelectContainer(container.id);
    onSelectMask(null);
  };

  const handleDeselect = () => onSelectMask(null);

  const handleStartRename = (container: MaskContainer) => {
    setRenamingContainerId(container.id);
    setTempName(container.name);
  };

  const handleRenameKeyDown = (e: any) => {
    if (e.key === 'Enter') {
      handleFinishRename();
    } else if (e.key === 'Escape') {
      setRenamingContainerId(null);
      setTempName('');
    }
  };

  const handleDuplicateContainer = (containerToDuplicate: MaskContainer) => {
    const newContainer = JSON.parse(JSON.stringify(containerToDuplicate));
    newContainer.id = uuidv4();
    newContainer.name = `${containerToDuplicate.name} Copy`;
    newContainer.subMasks = newContainer.subMasks.map((sm: SubMask) => ({ ...sm, id: uuidv4() }));
    setAdjustments((prev: Partial<Adjustments>) => ({ ...prev, masks: [...(prev.masks || []), newContainer] }));
  };

  const handlePasteContainer = () => {
    if (!copiedMask) {
      return;
    }
    const newContainer = JSON.parse(JSON.stringify(copiedMask));
    newContainer.id = uuidv4();
    newContainer.subMasks = newContainer.subMasks.map((sm: SubMask) => ({ ...sm, id: uuidv4() }));
    setAdjustments((prev: Partial<Adjustments>) => ({ ...prev, masks: [...(prev.masks || []), newContainer] }));
  };

  const handlePasteContainerAdjustments = (targetContainerId: string) => {
    if (!copiedMask) {
      return;
    }
    setAdjustments((prev: Partial<Adjustments>) => ({
      ...prev,
      masks: prev.masks?.map((c: MaskContainer) =>
        c.id === targetContainerId ? { ...c, adjustments: JSON.parse(JSON.stringify(copiedMask.adjustments)) } : c,
      ),
    }));
  };

  const handleContainerContextMenu = (event: any, container: MaskContainer) => {
    event.preventDefault();
    event.stopPropagation();
    showContextMenu(event.clientX, event.clientY, [
      { label: 'Edit Mask', icon: Edit, onClick: () => handleOpenContainerForEditing(container) },
      { label: 'Rename Mask', icon: FileEdit, onClick: () => handleStartRename(container) },
      { label: 'Duplicate Mask', icon: PlusSquare, onClick: () => handleDuplicateContainer(container) },
      { type: OPTION_SEPARATOR },
      { label: 'Copy Mask', icon: Copy, onClick: () => setCopiedMask(container) },
      {
        label: 'Paste Adjustments',
        icon: ClipboardPaste,
        disabled: !copiedMask,
        onClick: () => handlePasteContainerAdjustments(container.id),
      },
      { type: OPTION_SEPARATOR },
      { label: 'Delete Mask', icon: Trash2, isDestructive: true, onClick: () => handleDeleteContainer(container.id) },
    ]);
  };

  const handlePanelContextMenu = (event: any) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    showContextMenu(event.clientX, event.clientY, [
      { label: 'Paste Mask', icon: ClipboardPaste, disabled: !copiedMask, onClick: handlePasteContainer },
    ]);
  };

  const editingContainer = adjustments.masks.find((m: MaskContainer) => m.id === activeMaskContainerId);

  if (editingContainer) {
    const activeSubMask = editingContainer.subMasks.find((sm: SubMask) => sm.id === activeMaskId) ?? null;
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 flex justify-between items-center flex-shrink-0 border-b border-surface h-[69px]">
          <button
            className="p-2 rounded-full hover:bg-surface transition-colors flex-shrink-0"
            onClick={handleBackToList}
            title="Back to Mask List"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-grow min-w-0 text-center px-2">
            {renamingContainerId === editingContainer.id ? (
              <input
                autoFocus
                className="bg-transparent w-full text-xl font-bold text-primary text-shadow-shiny focus:outline-none focus:ring-1 focus:ring-accent rounded px-1 py-1 text-center"
                onBlur={handleFinishRename}
                onChange={(e: any) => setTempName(e.target.value)}
                onClick={(e: any) => e.stopPropagation()}
                onKeyDown={handleRenameKeyDown}
                type="text"
                value={tempName}
              />
            ) : (
              <h2
                className="text-xl font-bold text-primary text-shadow-shiny truncate cursor-pointer px-4 py-4"
                onClick={() => handleStartRename(editingContainer)}
                title="Click to rename"
              >
                {editingContainer.name}
              </h2>
            )}
          </div>
          <button
            className="p-2 rounded-full hover:bg-surface transition-colors flex-shrink-0"
            onClick={() => updateContainer(editingContainer.id, { adjustments: { ...INITIAL_MASK_ADJUSTMENTS } })}
            title="Reset Mask Adjustments"
          >
            <RotateCcw size={18} />
          </button>
        </div>
        <div className="flex-grow overflow-y-auto">
          <MaskControls
            activeMaskId={activeMaskId}
            activeSubMask={activeSubMask}
            aiModelDownloadStatus={aiModelDownloadStatus}
            brushSettings={brushSettings}
            editingMask={editingContainer}
            histogram={histogram}
            isGeneratingAiMask={isGeneratingAiMask}
            onGenerateAiForegroundMask={onGenerateAiForegroundMask}
            onSelectMask={onSelectMask}
            selectedImage={selectedImage}
            setAdjustments={setAdjustments}
            setBrushSettings={setBrushSettings}
            setIsMaskControlHovered={setIsMaskControlHovered}
            updateMask={updateContainer}
            updateSubMask={updateSubMask}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex justify-between items-center flex-shrink-0 border-b border-surface h-[69px]">
        <h2 className="text-xl font-bold text-primary text-shadow-shiny">Masking</h2>
        <button
          className="p-2 rounded-full hover:bg-surface transition-colors"
          disabled={adjustments.masks.length === 0}
          onClick={handleResetAllMasks}
          title="Reset All Masks"
        >
          <RotateCcw size={18} />
        </button>
      </div>
      <div
        className="flex-grow overflow-y-auto p-4 text-text-secondary space-y-6"
        onClick={handleDeselect}
        onContextMenu={handlePanelContextMenu}
      >
        <div onClick={(e: any) => e.stopPropagation()}>
          {aiModelDownloadStatus && (
            <div className="p-2 text-center text-xs text-text-secondary bg-surface rounded-md mb-4">
              Downloading AI Model: {aiModelDownloadStatus}
            </div>
          )}
          <p className="text-sm mb-3 font-semibold text-text-primary">Create New Mask</p>
          <div className="grid grid-cols-3 gap-2">
            {MASK_PANEL_TYPES.map((maskType: MaskType) => (
              <button
                className={`bg-surface text-text-primary rounded-lg p-2 flex flex-col items-center justify-center gap-1.5 aspect-square transition-colors ${
                  maskType.disabled || isGeneratingAiMask ? 'opacity-50 cursor-not-allowed' : 'hover:bg-card-active'
                }`}
                disabled={maskType.disabled || isGeneratingAiMask}
                key={maskType.type}
                onClick={() => handleAddMaskContainer(maskType.type)}
                title={maskType.disabled ? `${maskType.name} (Coming Soon)` : `Add ${maskType.name} Mask`}
              >
                <maskType.icon size={24} />
                <span className="text-xs">{maskType.name}</span>
              </button>
            ))}
          </div>
        </div>
        {adjustments.masks.length > 0 && (
          <div onClick={(e: any) => e.stopPropagation()}>
            <p className="text-sm mb-3 font-semibold text-text-primary">Masks ({adjustments.masks.length})</p>
            <div className="flex flex-col gap-2">
              <AnimatePresence>
                {adjustments.masks
                  .filter((c: MaskContainer) => c.id !== deletingItemId)
                  .map((container: MaskContainer, index: number) => (
                    <motion.div
                      animate="visible"
                      className={`group p-2 rounded-lg flex items-center justify-between cursor-pointer transition-all duration-200 ${
                        activeMaskContainerId === container.id ? 'bg-accent/20' : 'bg-surface hover:bg-card-active'
                      } ${!container.visible ? 'opacity-60' : 'opacity-100'}`}
                      custom={index}
                      exit="exit"
                      initial={isInitialRender.current ? 'hidden' : false}
                      key={container.id}
                      layout
                      onClick={() => handleOpenContainerForEditing(container)}
                      onContextMenu={(e: any) => handleContainerContextMenu(e, container)}
                      variants={itemVariants}
                    >
                      <div className="flex items-center gap-3 flex-grow min-w-0">
                        <ChevronsRight size={16} className="text-text-secondary flex-shrink-0" />
                        {renamingContainerId === container.id ? (
                          <input
                            autoFocus
                            className="bg-transparent w-full text-sm font-medium text-text-primary focus:outline-none focus:ring-1 focus:ring-accent rounded px-1 -mx-1"
                            onBlur={handleFinishRename}
                            onChange={(e: any) => setTempName(e.target.value)}
                            onClick={(e: any) => e.stopPropagation()}
                            onContextMenu={(e: any) => e.stopPropagation()}
                            onKeyDown={handleRenameKeyDown}
                            type="text"
                            value={tempName}
                          />
                        ) : (
                          <span className="font-medium text-sm text-text-primary truncate">{container.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          className="p-1.5 rounded-full text-text-secondary hover:bg-bg-primary"
                          onClick={(e: any) => {
                            e.stopPropagation();
                            handleToggleContainerVisibility(container.id);
                          }}
                          title={container.visible ? 'Hide Mask' : 'Show Mask'}
                        >
                          {container.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button
                          className="p-1.5 rounded-full text-text-secondary hover:text-red-500 hover:bg-red-500/10"
                          onClick={(e: any) => {
                            e.stopPropagation();
                            handleDeleteContainer(container.id);
                          }}
                          title="Delete Mask"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
