import Slider from '../ui/Slider';

export default function BasicAdjustments({ adjustments, setAdjustments }) {
  const handleAdjustmentChange = (key, value) => {
    // The value from the input is a string, so we parse it.
    const numericValue = parseInt(value, 10);
    setAdjustments(prev => ({ ...prev, [key]: numericValue }));
  };

  return (
    <div>
      <Slider
        label="Exposure"
        value={adjustments.exposure}
        onChange={(e) => handleAdjustmentChange('exposure', e.target.value)}
        min="-100"
        max="100"
        step="1"
      />
      <Slider
        label="Contrast"
        value={adjustments.contrast}
        onChange={(e) => handleAdjustmentChange('contrast', e.target.value)}
        min="-100"
        max="100"
        step="1"
      />
      <Slider
        label="Highlights"
        value={adjustments.highlights}
        onChange={(e) => handleAdjustmentChange('highlights', e.target.value)}
        min="-100"
        max="100"
        step="1"
      />
      <Slider
        label="Shadows"
        value={adjustments.shadows}
        onChange={(e) => handleAdjustmentChange('shadows', e.target.value)}
        min="-100"
        max="100"
        step="1"
      />
      <Slider
        label="Whites"
        value={adjustments.whites}
        onChange={(e) => handleAdjustmentChange('whites', e.target.value)}
        min="-100"
        max="100"
        step="1"
      />
      <Slider
        label="Blacks"
        value={adjustments.blacks}
        onChange={(e) => handleAdjustmentChange('blacks', e.target.value)}
        min="-100"
        max="100"
        step="1"
      />
    </div>
  );
}