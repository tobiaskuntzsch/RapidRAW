import { useState } from 'react';
import Slider from '../ui/Slider';
import ColorWheel from '../ui/ColorWheel';
import { ColorAdjustment, HueSatLum, INITIAL_ADJUSTMENTS } from '../../utils/adjustments';
import { Adjustments, ColorGrading } from '../../utils/adjustments';

interface ColorProps {
  color: string;
  name: string;
}

interface ColorPanelProps {
  adjustments: Adjustments;
  setAdjustments(adjustments: Partial<Adjustments>): any;
}

interface ColorSwatchProps {
  color: string;
  isActive: boolean;
  name: string;
  onClick: any;
}

const HSL_COLORS: Array<ColorProps> = [
  { name: 'reds', color: '#f87171' },
  { name: 'oranges', color: '#fb923c' },
  { name: 'yellows', color: '#facc15' },
  { name: 'greens', color: '#4ade80' },
  { name: 'aquas', color: '#2dd4bf' },
  { name: 'blues', color: '#60a5fa' },
  { name: 'purples', color: '#a78bfa' },
  { name: 'magentas', color: '#f472b6' },
];

const ColorSwatch = ({ color, name, isActive, onClick }: ColorSwatchProps) => (
  <button
    aria-label={`Select ${name} color`}
    className={`w-6 h-6 rounded-full focus:outline-none transition-transform duration-150 ${
      isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg-secondary transform scale-110' : 'hover:scale-110'
    }`}
    onClick={() => onClick(name)}
    style={{ backgroundColor: color }}
  />
);

const ColorGradingPanel = ({ adjustments, setAdjustments }: ColorPanelProps) => {
  const colorGrading = adjustments.colorGrading || INITIAL_ADJUSTMENTS.colorGrading;

  const handleChange = (grading: ColorGrading, newValue: HueSatLum) => {
    setAdjustments((prev: Partial<Adjustments>) => ({
      ...prev,
      colorGrading: {
        ...(prev.colorGrading || INITIAL_ADJUSTMENTS.colorGrading),
        [grading]: newValue,
      },
    }));
  };

  // --- FIX IS HERE ---
  // The `value` parameter is now correctly typed as a string.
  const handleGlobalChange = (grading: ColorGrading, value: string) => {
    setAdjustments((prev: Partial<Adjustments>) => ({
      ...prev,
      colorGrading: {
        ...(prev.colorGrading || INITIAL_ADJUSTMENTS.colorGrading),
        // Use parseFloat for safe conversion from string to number.
        [grading]: parseFloat(value),
      },
    }));
  };
  // --- END FIX ---

  return (
    <div>
      <div className="flex justify-center mb-4">
        <div className="w-[calc(50%-0.5rem)]">
          <ColorWheel
            defaultValue={INITIAL_ADJUSTMENTS.colorGrading.midtones}
            label="Midtones"
            onChange={(val: HueSatLum) => handleChange(ColorGrading.Midtones, val)}
            value={colorGrading.midtones}
          />
        </div>
      </div>
      <div className="flex justify-between mb-2 gap-4">
        <div className="w-full">
          <ColorWheel
            defaultValue={INITIAL_ADJUSTMENTS.colorGrading.shadows}
            label="Shadows"
            onChange={(val: HueSatLum) => handleChange(ColorGrading.Shadows, val)}
            value={colorGrading.shadows}
          />
        </div>
        <div className="w-full">
          <ColorWheel
            defaultValue={INITIAL_ADJUSTMENTS.colorGrading.highlights}
            label="Highlights"
            onChange={(val: HueSatLum) => handleChange(ColorGrading.Highlights, val)}
            value={colorGrading.highlights}
          />
        </div>
      </div>
      <div>
        <Slider
          defaultValue={50}
          label="Blending"
          max={100}
          min={0}
          onChange={(e: any) => handleGlobalChange(ColorGrading.Blending, e.target.value)}
          step={1}
          value={colorGrading.blending}
        />
        <Slider
          defaultValue={0}
          label="Balance"
          max={100}
          min={-100}
          onChange={(e: any) => handleGlobalChange(ColorGrading.Balance, e.target.value)}
          step={1}
          value={colorGrading.balance}
        />
      </div>
    </div>
  );
};

export default function ColorPanel({ adjustments, setAdjustments }: ColorPanelProps) {
  const [activeColor, setActiveColor] = useState('reds');

  const handleGlobalChange = (key: ColorAdjustment, value: string) => {
    setAdjustments((prev: Partial<Adjustments>) => ({ ...prev, [key]: parseFloat(value) }));
  };

  const handleHslChange = (key: ColorAdjustment, value: string) => {
    setAdjustments((prev: Partial<Adjustments>) => ({
      ...prev,
      hsl: {
        ...(prev.hsl || {}),
        [activeColor]: {
          ...(prev.hsl?.[activeColor] || {}),
          [key]: parseFloat(value),
        },
      },
    }));
  };

  const currentHsl = adjustments?.hsl?.[activeColor] || { hue: 0, saturation: 0, luminance: 0 };

  return (
    <div>
      <div className="mb-4 p-2 bg-bg-tertiary rounded-md">
        <p className="text-md font-semibold mb-2 text-primary">White Balance</p>
        <Slider
          label="Temperature"
          max={100}
          min={-100}
          onChange={(e: any) => handleGlobalChange(ColorAdjustment.Temperature, e.target.value)}
          step={1}
          value={adjustments.temperature || 0}
        />
        <Slider
          label="Tint"
          max={100}
          min={-100}
          onChange={(e: any) => handleGlobalChange(ColorAdjustment.Tint, e.target.value)}
          step={1}
          value={adjustments.tint || 0}
        />
      </div>

      <div className="mb-4 p-2 bg-bg-tertiary rounded-md">
        <p className="text-md font-semibold mb-2 text-primary">Presence</p>
        <Slider
          label="Vibrance"
          max={100}
          min={-100}
          onChange={(e: any) => handleGlobalChange(ColorAdjustment.Vibrance, e.target.value)}
          step={1}
          value={adjustments.vibrance || 0}
        />
        <Slider
          label="Saturation"
          max={100}
          min={-100}
          onChange={(e: any) => handleGlobalChange(ColorAdjustment.Saturation, e.target.value)}
          step={1}
          value={adjustments.saturation || 0}
        />
      </div>

      <div className="p-2 bg-bg-tertiary rounded-md mt-4">
        <p className="text-md font-semibold mb-3 text-primary">Color Grading</p>
        <ColorGradingPanel adjustments={adjustments} setAdjustments={setAdjustments} />
      </div>

      <div className="p-2 bg-bg-tertiary rounded-md mt-4">
        <p className="text-md font-semibold mb-3 text-primary">Color Mixer</p>
        <div className="flex justify-between mb-4 px-1">
          {HSL_COLORS.map(({ name, color }) => (
            <ColorSwatch
              color={color}
              isActive={activeColor === name}
              key={name}
              name={name}
              onClick={setActiveColor}
            />
          ))}
        </div>
        <Slider
          label="Hue"
          max={100}
          min={-100}
          onChange={(e: any) => handleHslChange(ColorAdjustment.Hue, e.target.value)}
          step={1}
          value={currentHsl.hue}
        />
        <Slider
          label="Saturation"
          max={100}
          min={-100}
          onChange={(e: any) => handleHslChange(ColorAdjustment.Saturation, e.target.value)}
          step={1}
          value={currentHsl.saturation}
        />
        <Slider
          label="Luminance"
          max={100}
          min={-100}
          onChange={(e: any) => handleHslChange(ColorAdjustment.Luminance, e.target.value)}
          step={1}
          value={currentHsl.luminance}
        />
      </div>
    </div>
  );
}
