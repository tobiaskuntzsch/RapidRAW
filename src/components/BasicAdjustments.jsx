const Slider = ({ label, value, onChange, min, max, step }) => (
  <div className="mb-4">
    {/* Label: Secondary text color */}
    <label className="block text-sm font-medium text-text-secondary">{label}</label>
    <div className="flex items-center gap-4 mt-1">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="w-full h-2 bg-surface rounded-full appearance-none cursor-pointer"
      />
      {/* Value: Primary text color */}
      <span className="text-sm text-text-primary w-12 text-center">{value}</span>
    </div>
  </div>
);

export default function BasicAdjustments({ adjustments, setAdjustments }) {
  const handleAdjustmentChange = (key, value) => {
    setAdjustments(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="pb-4 border-b border-border-color/30">
      {/* Section Title: Bold and "white" (accent color) */}
      <h3 className="text-lg font-bold mb-3 text-accent">Basic</h3>
      <Slider
        label="Brightness"
        value={adjustments.brightness}
        onChange={(e) => handleAdjustmentChange('brightness', parseInt(e.target.value))}
        min="-100"
        max="100"
        step="1"
      />
      <Slider
        label="Contrast"
        value={adjustments.contrast}
        onChange={(e) => handleAdjustmentChange('contrast', parseFloat(e.target.value))}
        min="-50"
        max="100"
        step="0.5"
      />
    </div>
  );
}