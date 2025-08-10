import Slider from '../ui/Slider';
import { Adjustments, DetailsAdjustment, Effect } from '../../utils/adjustments';

interface DetailsPanelProps {
  adjustments: Adjustments;
  setAdjustments(adjustments: Partial<Adjustments>): any;
}

export default function DetailsPanel({ adjustments, setAdjustments }: DetailsPanelProps) {
  const handleAdjustmentChange = (key: string, value: string) => {
    const numericValue = parseInt(value, 10);
    setAdjustments((prev: Partial<Adjustments>) => ({ ...prev, [key]: numericValue }));
  };

  return (
    <div>
      <div className="mb-4 p-2 bg-bg-tertiary rounded-md">
        <p className="text-md font-semibold mb-2 text-primary">Sharpening</p>
        <Slider
          label="Sharpness"
          max={100}
          min={0}
          onChange={(e: any) => handleAdjustmentChange(DetailsAdjustment.Sharpness, e.target.value)}
          step={1}
          value={adjustments.sharpness}
        />
      </div>

      <div className="mb-4 p-2 bg-bg-tertiary rounded-md">
        <p className="text-md font-semibold mb-2 text-primary">Presence</p>
        <Slider
          label="Clarity"
          max={100}
          min={-100}
          onChange={(e: any) => handleAdjustmentChange(Effect.Clarity, e.target.value)}
          step={1}
          value={adjustments.clarity}
        />
        <Slider
          label="Dehaze"
          max={100}
          min={-100}
          onChange={(e: any) => handleAdjustmentChange(Effect.Dehaze, e.target.value)}
          step={1}
          value={adjustments.dehaze}
        />
        <Slider
          label="Structure"
          max={100}
          min={-100}
          onChange={(e: any) => handleAdjustmentChange(Effect.Structure, e.target.value)}
          step={1}
          value={adjustments.structure}
        />
      </div>

      <div className="p-2 bg-bg-tertiary rounded-md">
        <p className="text-md font-semibold mb-2 text-primary">Noise Reduction</p>
        <Slider
          label="Luminance"
          max={100}
          min={0}
          onChange={(e: any) => handleAdjustmentChange(DetailsAdjustment.LumaNoiseReduction, e.target.value)}
          step={1}
          value={adjustments.lumaNoiseReduction}
        />
        <Slider
          label="Color"
          max={100}
          min={0}
          onChange={(e: any) => handleAdjustmentChange(DetailsAdjustment.ColorNoiseReduction, e.target.value)}
          step={1}
          value={adjustments.colorNoiseReduction}
        />
      </div>
    </div>
  );
}
