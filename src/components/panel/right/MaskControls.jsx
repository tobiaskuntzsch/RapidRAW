import { useState } from 'react';
import Slider from '../../ui/Slider';
import CollapsibleSection from '../../ui/CollapsibleSection';

// A simple, styled switch component for the "Invert" toggle
const Switch = ({ checked, onChange, label }) => (
  <label className="flex items-center justify-between cursor-pointer">
    <span className="text-sm font-medium text-text-primary">{label}</span>
    <div className="relative">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <div className="block bg-surface w-12 h-6 rounded-full"></div>
      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'transform translate-x-6 bg-accent' : ''}`}></div>
    </div>
  </label>
);

function MaskBasicAdjustments({ adjustments, setAdjustments }) {
  const handleAdjustmentChange = (key, value) => {
    const numericValue = parseInt(value, 10);
    const newAdjustments = {
      ...adjustments,
      [key]: isNaN(numericValue) ? 0 : numericValue,
    };
    setAdjustments(newAdjustments);
  };

  if (!adjustments) {
    return null; 
  }

  return (
    <div>
      <Slider
        label="Exposure"
        value={adjustments.exposure ?? 0}
        onChange={(e) => handleAdjustmentChange('exposure', e.target.value)}
        min="-100" max="100" step="1"
      />
      <Slider
        label="Contrast"
        value={adjustments.contrast ?? 0}
        onChange={(e) => handleAdjustmentChange('contrast', e.target.value)}
        min="-100" max="100" step="1"
      />
      <Slider
        label="Highlights"
        value={adjustments.highlights ?? 0}
        onChange={(e) => handleAdjustmentChange('highlights', e.target.value)}
        min="-100" max="100" step="1"
      />
      <Slider
        label="Shadows"
        value={adjustments.shadows ?? 0}
        onChange={(e) => handleAdjustmentChange('shadows', e.target.value)}
        min="-100" max="100" step="1"
      />
      <Slider
        label="Whites"
        value={adjustments.whites ?? 0}
        onChange={(e) => handleAdjustmentChange('whites', e.target.value)}
        min="-100" max="100" step="1"
      />
      <Slider
        label="Blacks"
        value={adjustments.blacks ?? 0}
        onChange={(e) => handleAdjustmentChange('blacks', e.target.value)}
        min="-100" max="100" step="1"
      />
    </div>
  );
}

export default function MaskControls({ editingMask, updateMask }) {
  const [isSettingsSectionOpen, setSettingsSectionOpen] = useState(true);
  const [isBasicSectionOpen, setBasicSectionOpen] = useState(true);

  if (!editingMask) return null;

  const handleParameterChange = (key, value) => {
    updateMask(editingMask.id, {
      ...editingMask,
      parameters: {
        ...editingMask.parameters,
        [key]: value,
      },
    });
  };

  const handleMaskPropertyChange = (key, value) => {
    updateMask(editingMask.id, {
      ...editingMask,
      [key]: value,
    });
  };

  const setMaskAdjustments = (newAdjustments) => {
    updateMask(editingMask.id, {
      ...editingMask,
      adjustments: newAdjustments,
    });
  };

  const showFeatherSlider = editingMask.type === 'radial' || editingMask.type === 'linear';

  return (
    <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-2">
      <div className="flex-shrink-0">
        <CollapsibleSection
          title="Mask Settings"
          isOpen={isSettingsSectionOpen}
          onToggle={() => setSettingsSectionOpen(prev => !prev)}
        >
          <div className="space-y-4">
            <Switch
              label="Invert Mask"
              checked={editingMask.invert}
              onChange={(e) => handleMaskPropertyChange('invert', e.target.checked)}
            />
            {showFeatherSlider && (
              <Slider
                label="Feather"
                value={editingMask.parameters.feather * 100}
                onChange={(e) => handleParameterChange('feather', parseFloat(e.target.value) / 100)}
                min="0"
                max="100"
                step="1"
              />
            )}
          </div>
        </CollapsibleSection>
      </div>
      <div className="flex-shrink-0">
        <CollapsibleSection
          title="Basic"
          isOpen={isBasicSectionOpen}
          onToggle={() => setBasicSectionOpen(prev => !prev)}
        >
          <MaskBasicAdjustments adjustments={editingMask.adjustments} setAdjustments={setMaskAdjustments} />
        </CollapsibleSection>
      </div>
    </div>
  );
}