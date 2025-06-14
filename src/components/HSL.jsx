// This Slider component is defined locally. We'll style it to match the others.
const Slider = ({ label, value, onChange, min, max, step }) => (
    <div className="mb-4">
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
        <span className="text-sm text-text-primary w-12 text-center">{value}</span>
      </div>
    </div>
  );

export default function HSL({ adjustments, setAdjustments }) {
    const handleAdjustmentChange = (key, value) => {
        setAdjustments(prev => ({ ...prev, [key]: value }));
    };

    return (
        // This is the last section, so no bottom border needed.
        <div className="pt-4"> 
            {/* Styled the title to be shiny */}
            <h3 className="text-lg font-bold mb-3 text-accent">Color</h3>
            <Slider
                label="Hue"
                value={adjustments.hue}
                onChange={(e) => handleAdjustmentChange('hue', parseInt(e.target.value))}
                min="-180"
                max="180"
                step="1"
            />
            <Slider
                label="Saturation"
                value={adjustments.saturation}
                onChange={(e) => handleAdjustmentChange('saturation', parseFloat(e.target.value))}
                min="-1"
                max="1"
                step="0.05"
            />
        </div>
    );
}