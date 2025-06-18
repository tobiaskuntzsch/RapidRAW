// MaskControls.jsx

import { useState } from 'react'; // <--- 1. Import useState
import Slider from '../../ui/Slider';
import CollapsibleSection from '../../ui/CollapsibleSection';

function MaskBasicAdjustments({ adjustments, setAdjustments }) {
  // ... (This component is fine, no changes needed here)
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

export default function MaskControls({ maskAdjustments, setMaskAdjustments }) {
  // 2. Add state for the collapsible section. Initialize with the value from your old `defaultOpen` prop.
  const [isBasicSectionOpen, setBasicSectionOpen] = useState(true);

  return (
    <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-2">
      <div className="flex-shrink-0">
        {/* 3. Pass the state and a toggle function as props */}
        <CollapsibleSection
          title="Basic"
          isOpen={isBasicSectionOpen}
          onToggle={() => setBasicSectionOpen(prev => !prev)}
        >
          <MaskBasicAdjustments adjustments={maskAdjustments} setAdjustments={setMaskAdjustments} />
        </CollapsibleSection>
      </div>
      {/* Add other adjustment sections like Color, etc. here in the future */}
    </div>
  );
}