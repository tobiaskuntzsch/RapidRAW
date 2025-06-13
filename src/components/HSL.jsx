const Slider = ({ label, value, onChange, min, max, step }) => (
    <div className="slider-container">
      <label className="label">{label}</label>
      <div className="slider-wrapper">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          className="slider-track"
        />
        <span className="slider-value">{value}</span>
      </div>
    </div>
  );

export default function HSL({ adjustments, setAdjustments }) {
    const handleAdjustmentChange = (key, value) => {
        setAdjustments(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="p-4"> {/* No border on the last section */}
            <h3 className="section-title">Color</h3>
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