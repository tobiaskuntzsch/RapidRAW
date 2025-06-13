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

export default function BasicAdjustments({ adjustments, setAdjustments }) {
  const handleAdjustmentChange = (key, value) => {
    setAdjustments(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="section">
      <h3 className="section-title">Basic</h3>
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