import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import debounce from 'lodash.debounce';

export function usePresets(currentAdjustments) {
  const [presets, setPresets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPresets = useCallback(async () => {
    setIsLoading(true);
    try {
      const loadedPresets = await invoke('load_presets');
      setPresets(loadedPresets);
    } catch (error) {
      console.error('Failed to load presets:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const savePresets = useCallback(debounce((presetsToSave) => {
    invoke('save_presets', { presets: presetsToSave })
      .catch(err => console.error("Failed to save presets:", err));
  }, 500), []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const addPreset = (name) => {
    const newPreset = {
      id: crypto.randomUUID(),
      name,
      adjustments: currentAdjustments,
    };
    const updatedPresets = [...presets, newPreset];
    setPresets(updatedPresets);
    savePresets(updatedPresets);
  };

  const deletePreset = (id) => {
    const updatedPresets = presets.filter(p => p.id !== id);
    setPresets(updatedPresets);
    savePresets(updatedPresets);
  };

  const renamePreset = (id, newName) => {
    const updatedPresets = presets.map(p => 
      p.id === id ? { ...p, name: newName } : p
    );
    setPresets(updatedPresets);
    savePresets(updatedPresets);
  };

  const reorderPresets = (result) => {
    if (!result.destination) return;

    const items = Array.from(presets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setPresets(items);
    savePresets(items);
  };

  return {
    presets,
    isLoading,
    addPreset,
    deletePreset,
    renamePreset,
    reorderPresets,
  };
}