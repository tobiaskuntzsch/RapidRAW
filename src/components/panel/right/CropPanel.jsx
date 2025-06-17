import { RotateCcw, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { INITIAL_ADJUSTMENTS } from '../../../App';

const PRESETS = [
  { name: 'Free', value: null },
  { name: 'Original', value: 'original' },
  { name: '1:1', value: 1 / 1 },
  { name: '4:3', value: 4 / 3 },
  { name: '3:2', value: 3 / 2 },
  { name: '16:9', value: 16 / 9 },
];

export default function CropPanel({ selectedImage, adjustments, setAdjustments }) {
  const [customW, setCustomW] = useState('');
  const [customH, setCustomH] = useState('');
  const [isCustomActive, setIsCustomActive] = useState(false);

  useEffect(() => {
    const w = parseFloat(customW);
    const h = parseFloat(customH);

    if (isCustomActive && w > 0 && h > 0) {
      const newAspectRatio = w / h;
      if (adjustments.aspectRatio !== newAspectRatio) {
        setAdjustments(prev => ({
          ...prev,
          aspectRatio: newAspectRatio,
          crop: null,
        }));
      }
    }
  }, [customW, customH, isCustomActive, adjustments.aspectRatio, setAdjustments]);

  useEffect(() => {
    if (adjustments.aspectRatio === null) {
      setIsCustomActive(false);
      return;
    }
    const isPreset = PRESETS.some(p => {
        if (p.value === 'original') return false;
        return p.value === adjustments.aspectRatio
    });

    if (!isPreset) {
      setIsCustomActive(true);
    }
  }, [adjustments.aspectRatio]);

  const handlePresetClick = (preset) => {
    setIsCustomActive(false);
    setCustomW('');
    setCustomH('');

    let newAspectRatio = preset.value;
    if (preset.value === 'original') {
      newAspectRatio = selectedImage?.width && selectedImage?.height
        ? selectedImage.width / selectedImage.height
        : null;
    }

    setAdjustments(prev => ({
      ...prev,
      aspectRatio: newAspectRatio,
      crop: null,
    }));
  };

  const handleCustomClick = () => {
    setIsCustomActive(true);
  };

  const handleReset = () => {
    setAdjustments(prev => ({
      ...prev,
      crop: INITIAL_ADJUSTMENTS.crop,
      aspectRatio: INITIAL_ADJUSTMENTS.aspectRatio,
    }));
    setCustomW('');
    setCustomH('');
    setIsCustomActive(false);
  };

  const isPresetActive = (preset) => {
    if (preset.value === null && adjustments.aspectRatio === null) return true;
    if (preset.value === 'original') {
      const originalRatio = selectedImage?.width && selectedImage?.height
        ? selectedImage.width / selectedImage.height
        : null;
      return Math.abs(adjustments.aspectRatio - originalRatio) < 0.001;
    }
    return adjustments.aspectRatio === preset.value;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex justify-between items-center flex-shrink-0">
        <h2 className="text-xl font-bold text-primary text-shadow-shiny">Crop & Rotate</h2>
        <button
          onClick={handleReset}
          className="p-2 rounded-full hover:bg-surface transition-colors"
          title="Reset Crop & Aspect Ratio"
        >
          <RotateCcw size={18} />
        </button>
      </div>
      <div className="flex-grow overflow-y-auto p-4 text-text-secondary space-y-6">
        {selectedImage ? (
          <>
            <div>
              <p className="text-sm mb-3 font-semibold text-text-primary">Aspect Ratio</p>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => handlePresetClick(preset)}
                    className={`px-2 py-1.5 text-sm rounded-md transition-colors ${
                      isPresetActive(preset) && !isCustomActive
                        ? 'bg-surface text-white'
                        : 'bg-surface hover:bg-card-active'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
                <button
                  onClick={handleCustomClick}
                  className={`px-2 py-1.5 text-sm rounded-md transition-colors col-span-1 ${
                    isCustomActive
                      ? 'bg-surface text-white'
                      : 'bg-surface hover:bg-card-active'
                  }`}
                >
                  Custom
                </button>
              </div>
              {isCustomActive && (
                <div className="mt-3 bg-surface p-3 rounded-md">
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="number"
                      placeholder="W"
                      value={customW}
                      onChange={(e) => setCustomW(e.target.value)}
                      className="w-full bg-bg-primary text-center rounded-md p-1 border border-surface focus:border-accent focus:ring-accent"
                      min="1"
                    />
                    <X size={16} className="text-text-tertiary flex-shrink-0" />
                    <input
                      type="number"
                      placeholder="H"
                      value={customH}
                      onChange={(e) => setCustomH(e.target.value)}
                      className="w-full bg-bg-primary text-center rounded-md p-1 border border-surface focus:border-accent focus:ring-accent"
                      min="1"
                    />
                  </div>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm mt-4 mb-2">Use the handles in the editor to draw a crop.</p>
              <p className="text-xs text-text-tertiary">More controls for rotation will be added here in the future.</p>
            </div>
          </>
        ) : (
          <p>No image selected.</p>
        )}
      </div>
    </div>
  );
}