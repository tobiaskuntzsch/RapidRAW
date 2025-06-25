import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Circle, Waves, Brush, Droplet, Sun, Sparkles,
  Trash2, RotateCcw, ArrowLeft, Eye, EyeOff, Edit, Copy, ClipboardPaste, PlusSquare
} from 'lucide-react';
import MaskControls from './MaskControls';
import { INITIAL_MASK_ADJUSTMENTS } from '../../../App';
import { useContextMenu } from '../../../context/ContextMenuContext';

const MASK_TYPES = [
  { id: 'ai-subject', name: 'Subject', icon: Sparkles, type: 'ai-subject' },
  { id: 'brush', name: 'Brush', icon: Brush, type: 'brush' },
  { id: 'linear', name: 'Linear', icon: Waves, type: 'linear' },
  { id: 'radial', name: 'Radial', icon: Circle, type: 'radial' },
  { id: 'color', name: 'Color', icon: Droplet, type: 'color' },
  { id: 'luminance', name: 'Luminance', icon: Sun, type: 'luminance' },
];

const BrushTools = ({ settings, setSettings }) => (
  <div className="p-4 space-y-4 border-b border-surface">
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium text-text-primary">Brush Size</label>
      <span className="text-sm text-text-primary">{settings.size.toFixed(0)}px</span>
    </div>
    <input
      type="range"
      min="1"
      max="200"
      value={settings.size}
      onChange={(e) => setSettings(s => ({ ...s, size: Number(e.target.value) }))}
      className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-accent"
    />
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium text-text-primary">Brush Feather</label>
      <span className="text-sm text-text-primary">{settings.feather.toFixed(0)}%</span>
    </div>
    <input
      type="range"
      min="0"
      max="100"
      value={settings.feather}
      onChange={(e) => setSettings(s => ({ ...s, feather: Number(e.target.value) }))}
      className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-accent"
    />
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={() => setSettings(s => ({ ...s, tool: 'brush' }))}
        className={`p-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${settings.tool === 'brush' ? 'text-white bg-surface' : 'bg-surface text-text-secondary hover:bg-card-active'}`}
      >
        Brush
      </button>
      <button
        onClick={() => setSettings(s => ({ ...s, tool: 'eraser' }))}
        className={`p-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${settings.tool === 'eraser' ? 'text-white bg-surface' : 'bg-surface text-text-secondary hover:bg-card-active'}`}
      >
        Eraser
      </button>
    </div>
  </div>
);

export default function MasksPanel({
  adjustments, setAdjustments, selectedImage, onSelectMask, activeMaskId,
  brushSettings, setBrushSettings, copiedMask, setCopiedMask
}) {
  const [editingMaskId, setEditingMaskId] = useState(null);
  const { showContextMenu } = useContextMenu();

  const masks = adjustments.masks || [];

  const handleAddMask = (type) => {
    const { width, height } = selectedImage;
    let newMask;
    const common = {
      id: uuidv4(),
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Mask`,
      type,
      visible: true,
      invert: false,
      adjustments: { ...INITIAL_MASK_ADJUSTMENTS },
    };

    switch (type) {
      case 'radial':
        newMask = {
          ...common,
          parameters: {
            centerX: width / 2,
            centerY: height / 2,
            radiusX: width / 4,
            radiusY: width / 4,
            rotation: 0,
            feather: 0.5,
          }
        };
        break;
      case 'linear':
        newMask = {
          ...common,
          parameters: {
            startX: width * 0.25,
            startY: height / 2,
            endX: width * 0.75,
            endY: height / 2,
            feather: 0.5,
            range: 50,
          }
        };
        break;
      case 'brush':
        newMask = { ...common, parameters: { lines: [] } };
        break;
      case 'color':
      case 'luminance':
      case 'ai-subject':
        newMask = { ...common, parameters: {} };
        break;
      default:
        return;
    }

    setAdjustments(prev => ({ ...prev, masks: [...(prev.masks || []), newMask] }));
    onSelectMask(newMask.id);
    setEditingMaskId(newMask.id);
  };

  const handleDeleteMask = (id) => {
    if (editingMaskId === id) setEditingMaskId(null);
    if (activeMaskId === id) onSelectMask(null);
    setAdjustments(prev => ({ ...prev, masks: (prev.masks || []).filter(mask => mask.id !== id) }));
  };

  const handleDuplicateMask = (id) => {
    const maskToDuplicate = masks.find(m => m.id === id);
    if (!maskToDuplicate) return;

    const newMask = JSON.parse(JSON.stringify(maskToDuplicate));
    newMask.id = uuidv4();
    newMask.name = `${maskToDuplicate.name} Copy`;

    setAdjustments(prev => ({ ...prev, masks: [...(prev.masks || []), newMask] }));
  };

  const handlePasteMask = () => {
    if (!copiedMask) return;
    
    const newMask = JSON.parse(JSON.stringify(copiedMask));
    newMask.id = uuidv4();

    setAdjustments(prev => ({ ...prev, masks: [...(prev.masks || []), newMask] }));
  };

  const handlePasteMaskAdjustments = (targetMaskId) => {
    if (!copiedMask) return;
    setAdjustments(prev => ({
      ...prev,
      masks: prev.masks.map(m => 
        m.id === targetMaskId ? { ...m, adjustments: JSON.parse(JSON.stringify(copiedMask.adjustments)) } : m
      )
    }));
  };

  const handleResetAllMasks = () => {
    setEditingMaskId(null);
    onSelectMask(null);
    setAdjustments(prev => ({ ...prev, masks: [] }));
  };

  const handleToggleVisibility = (id) => {
    setAdjustments(prev => ({
      ...prev,
      masks: prev.masks.map(m => m.id === id ? { ...m, visible: !m.visible } : m)
    }));
  };

  const handleSelectMaskForEditing = (id) => {
    setEditingMaskId(id);
    onSelectMask(id);
  };

  const handleBackToList = () => {
    setEditingMaskId(null);
    onSelectMask(null);
  };

  const updateMask = (maskId, updatedMaskData) => {
    setAdjustments(prev => ({
      ...prev,
      masks: (prev.masks || []).map(mask =>
        mask.id === maskId ? updatedMaskData : mask
      ),
    }));
  };

  const resetCurrentMaskAdjustments = () => {
    if (!editingMaskId) return;
    const maskToUpdate = masks.find(m => m.id === editingMaskId);
    if (maskToUpdate) {
      updateMask(editingMaskId, { ...maskToUpdate, adjustments: { ...INITIAL_MASK_ADJUSTMENTS } });
    }
  };

  const handleMaskContextMenu = (event, mask) => {
    event.preventDefault();
    event.stopPropagation();

    const options = [
      { label: 'Edit Mask', icon: Edit, onClick: () => handleSelectMaskForEditing(mask.id) },
      { label: 'Duplicate Mask', icon: PlusSquare, onClick: () => handleDuplicateMask(mask.id) },
      { type: 'separator' },
      { label: 'Copy Mask', icon: Copy, onClick: () => setCopiedMask(mask) },
      { label: 'Paste Adjustments', icon: ClipboardPaste, disabled: !copiedMask, onClick: () => handlePasteMaskAdjustments(mask.id) },
      { type: 'separator' },
      { label: 'Delete Mask', icon: Trash2, isDestructive: true, onClick: () => handleDeleteMask(mask.id) },
    ];

    showContextMenu(event.clientX, event.clientY, options);
  };

  const handlePanelContextMenu = (event) => {
    if (event.target !== event.currentTarget) return;

    event.preventDefault();
    event.stopPropagation();

    const options = [
      { label: 'Paste Mask', icon: ClipboardPaste, disabled: !copiedMask, onClick: handlePasteMask },
    ];

    showContextMenu(event.clientX, event.clientY, options);
  };

  const editingMask = masks.find(m => m.id === editingMaskId);

  if (editingMask) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 flex justify-between items-center flex-shrink-0 border-b border-surface">
          <button onClick={handleBackToList} className="p-2 rounded-full hover:bg-surface transition-colors" title="Back to Mask List">
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-bold text-primary text-shadow-shiny truncate capitalize">
            Edit {editingMask.type} Mask
          </h2>
          <button onClick={resetCurrentMaskAdjustments} className="p-2 rounded-full hover:bg-surface transition-colors" title="Reset Mask Adjustments">
            <RotateCcw size={18} />
          </button>
        </div>
        {editingMask.type === 'brush' && brushSettings && setBrushSettings && (
          <BrushTools settings={brushSettings} setSettings={setBrushSettings} />
        )}
        <MaskControls
          editingMask={editingMask}
          updateMask={updateMask}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex justify-between items-center flex-shrink-0 border-b border-surface">
        <h2 className="text-xl font-bold text-primary text-shadow-shiny">Masking</h2>
        <button
          onClick={handleResetAllMasks}
          className="p-2 rounded-full hover:bg-surface transition-colors"
          title="Reset All Masks"
          disabled={masks.length === 0}
        >
          <RotateCcw size={18} />
        </button>
      </div>

      <div className="flex-grow overflow-y-auto p-4 text-text-secondary space-y-6" onContextMenu={handlePanelContextMenu}>
        <div>
          <p className="text-sm mb-3 font-semibold text-text-primary">Create New Mask</p>
          <div className="grid grid-cols-3 gap-2">
            {MASK_TYPES.map(maskType => (
              <button
                key={maskType.id}
                onClick={() => handleAddMask(maskType.type)}
                className="bg-surface hover:bg-card-active text-text-primary rounded-lg p-2 flex flex-col items-center justify-center gap-1.5 aspect-square transition-colors"
                title={`Add ${maskType.name} Mask`}
              >
                <maskType.icon size={24} />
                <span className="text-xs">{maskType.name}</span>
              </button>
            ))}
          </div>
        </div>

        {masks.length > 0 && (
          <div>
            <p className="text-sm mb-3 font-semibold text-text-primary">Masks ({masks.length})</p>
            <div className="flex flex-col gap-2">
              {masks.map((mask, index) => {
                const MaskIcon = MASK_TYPES.find(mt => mt.type === mask.type)?.icon || Circle;
                return (
                  <div
                    key={mask.id}
                    onClick={() => handleSelectMaskForEditing(mask.id)}
                    onContextMenu={(e) => handleMaskContextMenu(e, mask)}
                    className={`group p-2 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                      activeMaskId === mask.id ? 'bg-accent/20' : 'bg-surface hover:bg-card-active'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <MaskIcon size={16} className="text-text-secondary" />
                      <span className="font-medium text-sm text-text-primary capitalize">
                        {mask.name || `${mask.type} ${index + 1}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleVisibility(mask.id); }}
                        className="p-1.5 rounded-full text-text-secondary hover:bg-bg-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200"
                        title={mask.visible ? "Hide Mask" : "Show Mask"}
                      >
                        {mask.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}