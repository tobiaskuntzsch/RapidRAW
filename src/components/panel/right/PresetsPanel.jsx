import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { usePresets } from '../../../hooks/usePresets';
import { useContextMenu } from '../../../context/ContextMenuContext';
import { Plus, Loader2 } from 'lucide-react';
import AddPresetModal from '../../modals/AddPresetModal';
import RenamePresetModal from '../../modals/RenamePresetModal';
import { INITIAL_ADJUSTMENTS } from '../../../App';

export default function PresetsPanel({ adjustments, setAdjustments, selectedImage, activePanel }) {
  const { presets, isLoading, addPreset, deletePreset, renamePreset } = usePresets(adjustments);
  const { showContextMenu } = useContextMenu();
  const [previews, setPreviews] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [renameModalState, setRenameModalState] = useState({ isOpen: false, preset: null });

  const generatePreviews = useCallback(async () => {
    if (!selectedImage?.isReady || presets.length === 0) return;
    
    setIsGenerating(true);
    const newPreviews = {};
    
    for (const preset of presets) {
      try {
        const fullPresetAdjustments = { ...INITIAL_ADJUSTMENTS, ...preset.adjustments };
        const previewUrl = await invoke('generate_preset_preview', { jsAdjustments: fullPresetAdjustments });
        newPreviews[preset.id] = previewUrl;
      } catch (error) {
        console.error(`Failed to generate preview for preset ${preset.name}:`, error);
        newPreviews[preset.id] = null;
      }
    }
    setPreviews(newPreviews);
    setIsGenerating(false);
  }, [presets, selectedImage]);

  useEffect(() => {
    if (activePanel === 'presets') {
      generatePreviews();
    } else {
      setPreviews({});
    }
  }, [activePanel, generatePreviews]);

  const handleApplyPreset = (preset) => {
    const newAdjustments = {
      ...INITIAL_ADJUSTMENTS,
      ...preset.adjustments,
    };
    setAdjustments(newAdjustments);
  };

  const handleSavePreset = (name) => {
    addPreset(name);
    setIsAddModalOpen(false);
  };

  const handleRenameSave = (newName) => {
    if (renameModalState.preset) {
      renamePreset(renameModalState.preset.id, newName);
    }
    setRenameModalState({ isOpen: false, preset: null });
  };

  const handleContextMenu = (event, preset) => {
    event.preventDefault();
    const options = [
      {
        label: 'Rename',
        onClick: () => {
          setRenameModalState({ isOpen: true, preset: preset });
        },
      },
      {
        label: 'Delete',
        onClick: () => deletePreset(preset.id),
        isDestructive: true,
      },
    ];
    showContextMenu(event.clientX, event.clientY, options);
  };

  const sortedPresets = [...presets].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-4 text-center text-text-secondary">
        Loading presets...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex justify-between items-center flex-shrink-0">
        <h2 className="text-xl font-bold text-primary text-shadow-shiny">Presets</h2>
        <button 
          onClick={() => setIsAddModalOpen(true)} 
          title="Save current settings as new preset" 
          className="p-2 rounded-full hover:bg-surface transition-colors"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="flex-grow overflow-y-auto p-4">
        <div className="space-y-2">
          {sortedPresets.map((preset) => (
            <div
              key={preset.id}
              onClick={() => handleApplyPreset(preset)}
              onContextMenu={(e) => handleContextMenu(e, preset)}
              className="flex items-center gap-2 p-2 rounded-lg bg-bg-primary cursor-pointer"
            >
              <div className="w-20 h-14 bg-bg-tertiary rounded-md flex items-center justify-center flex-shrink-0">
                {previews[preset.id] ? (
                  <img src={previews[preset.id]} alt={`${preset.name} preview`} className="w-full h-full object-cover rounded-md" />
                ) : (
                  <Loader2 size={20} className="animate-spin text-text-secondary" />
                )}
              </div>
              <div className="flex-grow">
                <p className="font-medium truncate">{preset.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <AddPresetModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSavePreset}
      />
      <RenamePresetModal
        isOpen={renameModalState.isOpen}
        onClose={() => setRenameModalState({ isOpen: false, preset: null })}
        onSave={handleRenameSave}
        currentName={renameModalState.preset?.name}
      />
    </div>
  );
}