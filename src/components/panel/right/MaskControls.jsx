import { useState } from 'react';
import Slider from '../../ui/Slider';
import CollapsibleSection from '../../ui/CollapsibleSection';
import Switch from '../../ui/Switch';

const MASK_TYPE_CONFIG = {
  radial: {
    parameters: [
      {
        key: 'feather',
        label: 'Feather',
        min: 0,
        max: 100,
        step: 1,
        multiplier: 100,
      },
    ],
  },
  brush: {
    showBrushTools: true,
  },
  linear: { parameters: [] },
  color: { parameters: [] },
  luminance: { parameters: [] },
  'ai-subject': { parameters: [] },
};

const BrushTools = ({ settings, onSettingsChange }) => (
  <div className="space-y-4 pt-4 border-t border-surface mt-4">
    <Slider
      label="Brush Size"
      value={settings.size}
      onChange={(e) => onSettingsChange(s => ({ ...s, size: Number(e.target.value) }))}
      min="1"
      max="200"
      step="1"
    />
    <Slider
      label="Brush Feather"
      value={settings.feather}
      onChange={(e) => onSettingsChange(s => ({ ...s, feather: Number(e.target.value) }))}
      min="0"
      max="100"
      step="1"
    />
    <div className="grid grid-cols-2 gap-2 pt-2">
      <button
        onClick={() => onSettingsChange(s => ({ ...s, tool: 'brush' }))}
        className={`p-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${settings.tool === 'brush' ? 'text-white bg-surface' : 'bg-surface text-text-secondary hover:bg-card-active'}`}
      >
        Brush
      </button>
      <button
        onClick={() => onSettingsChange(s => ({ ...s, tool: 'eraser' }))}
        className={`p-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${settings.tool === 'eraser' ? 'text-white bg-surface' : 'bg-surface text-text-secondary hover:bg-card-active'}`}
      >
        Eraser
      </button>
    </div>
  </div>
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

export default function MaskControls({ editingMask, updateMask, brushSettings, setBrushSettings }) {
  const [isSettingsSectionOpen, setSettingsSectionOpen] = useState(true);
  const [isBasicSectionOpen, setBasicSectionOpen] = useState(true);

  if (!editingMask) return null;

  const maskConfig = MASK_TYPE_CONFIG[editingMask.type] || {};

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

  return (
    <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-2">
      <div className="flex-shrink-0">
        <CollapsibleSection
          title="Settings"
          isOpen={isSettingsSectionOpen}
          onToggle={() => setSettingsSectionOpen(prev => !prev)}
        >
          <div className="space-y-2">
            <Switch
              label="Invert Mask"
              checked={!!editingMask.invert}
              onChange={(checked) => handleMaskPropertyChange('invert', checked)}
            />
            {maskConfig.parameters?.map(param => (
              <Slider
                key={param.key}
                label={param.label}
                value={(editingMask.parameters[param.key] || 0) * (param.multiplier || 1)}
                onChange={(e) => handleParameterChange(param.key, parseFloat(e.target.value) / (param.multiplier || 1))}
                min={param.min}
                max={param.max}
                step={param.step}
              />
            ))}
            {maskConfig.showBrushTools && brushSettings && setBrushSettings && (
              <BrushTools settings={brushSettings} onSettingsChange={setBrushSettings} />
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