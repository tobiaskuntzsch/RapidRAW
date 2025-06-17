import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Circle, Minus, Plus, Trash2, ArrowLeft, Waves } from 'lucide-react';
import MaskControls from './MaskControls';
import { INITIAL_MASK_ADJUSTMENTS } from '../../../App';

export default function MasksPanel({ adjustments, setAdjustments, selectedImage, onSelectMask, activeMaskId }) {
  const [editingMaskId, setEditingMaskId] = useState(null);

  const masks = adjustments.masks || [];

  const handleAddMask = (type) => {
    const { width, height } = selectedImage;
    let newMask;
    const common = {
      id: uuidv4(),
      type,
      invert: false,
      rotation: 0,
      adjustments: { ...INITIAL_MASK_ADJUSTMENTS },
    };

    if (type === 'radial') {
      newMask = {
        ...common,
        feather: 0.5,
        geometry: {
          x: width / 2,
          y: height / 2,
          radiusX: width / 4,
          radiusY: width / 4,
        },
      };
    } else if (type === 'linear') {
      newMask = {
        ...common,
        feather: 0.5,
        geometry: {
          startX: width * 0.25,
          startY: height / 2,
          endX: width * 0.75,
          endY: height / 2,
        },
      };
    }

    if (newMask) {
      setAdjustments(prev => ({
        ...prev,
        masks: [...(prev.masks || []), newMask],
      }));
      onSelectMask(newMask.id);
    }
  };

  const handleDeleteMask = (id) => {
    if (editingMaskId === id) {
      setEditingMaskId(null);
    }
    if (activeMaskId === id) {
      onSelectMask(null);
    }
    setAdjustments(prev => ({
      ...prev,
      masks: (prev.masks || []).filter(mask => mask.id !== id),
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

  const updateMaskAdjustments = (maskId, newMaskAdjustments) => {
    setAdjustments(prev => ({
      ...prev,
      masks: (prev.masks || []).map(mask =>
        mask.id === maskId ? { ...mask, adjustments: newMaskAdjustments } : mask
      ),
    }));
  };

  const editingMask = masks.find(m => m.id === editingMaskId);

  if (editingMask) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 flex justify-between items-center flex-shrink-0">
          <button onClick={handleBackToList} className="p-2 rounded-full hover:bg-surface transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-bold text-primary text-shadow-shiny truncate">
            Edit {editingMask.type} mask
          </h2>
          <div className="w-8" />
        </div>
        <MaskControls
          maskAdjustments={editingMask.adjustments}
          setMaskAdjustments={(newAdjustments) => updateMaskAdjustments(editingMask.id, newAdjustments)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex justify-between items-center flex-shrink-0">
        <h2 className="text-xl font-bold text-primary text-shadow-shiny">Masks</h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleAddMask('radial')}
            className="p-2 rounded-full hover:bg-surface transition-colors"
            title="Add Radial Gradient"
          >
            <Circle size={18} />
          </button>
          <button
            onClick={() => handleAddMask('linear')}
            className="p-2 rounded-full hover:bg-surface transition-colors"
            title="Add Linear Gradient"
          >
            <Waves size={18} />
          </button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto p-4 text-text-secondary space-y-2">
        {masks.length === 0 ? (
          <p className="text-sm text-center text-text-tertiary mt-4">No masks added yet. Click a button above to create one.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {masks.map((mask, index) => (
              <div
                key={mask.id}
                onClick={() => handleSelectMaskForEditing(mask.id)}
                className={`p-3 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                  activeMaskId === mask.id ? 'bg-accent/20' : 'bg-surface hover:bg-card-active'
                }`}
              >
                <div className="flex items-center gap-3">
                  {mask.type === 'radial' ? <Circle size={16} /> : <Waves size={16} />}
                  <span className="font-medium text-sm text-text-primary">
                    Mask {index + 1} ({mask.type})
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMask(mask.id);
                  }}
                  className="p-1.5 rounded-full text-text-secondary hover:bg-red-500/20 hover:text-red-400"
                  title="Delete Mask"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}