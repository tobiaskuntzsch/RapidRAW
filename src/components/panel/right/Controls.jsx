import { RotateCcw, Copy, ClipboardPaste } from 'lucide-react';
import BasicAdjustments from '../../adjustments/BasicAdjustments';
import CurveGraph from '../../adjustments/CurveGraph';
import ColorPanel from '../../adjustments/ColorPanel';
import DetailsPanel from '../../adjustments/DetailsPanel';
import EffectsPanel from '../../adjustments/EffectsPanel';
import CollapsibleSection from '../../ui/CollapsibleSection';
import { INITIAL_ADJUSTMENTS, ADJUSTMENT_SECTIONS } from '../../../App';
import { useContextMenu } from '../../../context/ContextMenuContext';

export default function Controls({
  adjustments,
  setAdjustments,
  selectedImage,
  histogram,
  collapsibleState,
  setCollapsibleState,
  copiedSectionAdjustments,
  setCopiedSectionAdjustments,
}) {
  const { showContextMenu } = useContextMenu();

  const handleResetAdjustments = () => {
    setAdjustments(prev => ({
      ...prev,

      exposure: INITIAL_ADJUSTMENTS.exposure,
      contrast: INITIAL_ADJUSTMENTS.contrast,
      highlights: INITIAL_ADJUSTMENTS.highlights,
      shadows: INITIAL_ADJUSTMENTS.shadows,
      whites: INITIAL_ADJUSTMENTS.whites,
      blacks: INITIAL_ADJUSTMENTS.blacks,
      saturation: INITIAL_ADJUSTMENTS.saturation,
      temperature: INITIAL_ADJUSTMENTS.temperature,
      tint: INITIAL_ADJUSTMENTS.tint,
      vibrance: INITIAL_ADJUSTMENTS.vibrance,

      sharpness: INITIAL_ADJUSTMENTS.sharpness,
      lumaNoiseReduction: INITIAL_ADJUSTMENTS.lumaNoiseReduction,
      colorNoiseReduction: INITIAL_ADJUSTMENTS.colorNoiseReduction,

      clarity: INITIAL_ADJUSTMENTS.clarity,
      dehaze: INITIAL_ADJUSTMENTS.dehaze,
      structure: INITIAL_ADJUSTMENTS.structure,
      vignetteAmount: INITIAL_ADJUSTMENTS.vignetteAmount,
      vignetteMidpoint: INITIAL_ADJUSTMENTS.vignetteMidpoint,
      vignetteRoundness: INITIAL_ADJUSTMENTS.vignetteRoundness,
      vignetteFeather: INITIAL_ADJUSTMENTS.vignetteFeather,
      grainAmount: INITIAL_ADJUSTMENTS.grainAmount,
      grainSize: INITIAL_ADJUSTMENTS.grainSize,
      grainRoughness: INITIAL_ADJUSTMENTS.grainRoughness,

      hsl: INITIAL_ADJUSTMENTS.hsl,
      curves: INITIAL_ADJUSTMENTS.curves,
    }));
  };

  const handleToggleSection = (section) => {
    setCollapsibleState(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSectionContextMenu = (event, sectionName) => {
    event.preventDefault();
    event.stopPropagation();

    const sectionKeys = ADJUSTMENT_SECTIONS[sectionName];
    if (!sectionKeys) return;

    const handleCopy = () => {
      const adjustmentsToCopy = {};
      for (const key of sectionKeys) {
        if (adjustments.hasOwnProperty(key)) {
          adjustmentsToCopy[key] = JSON.parse(JSON.stringify(adjustments[key]));
        }
      }
      setCopiedSectionAdjustments({
        section: sectionName,
        values: adjustmentsToCopy,
      });
    };

    const handlePaste = () => {
      if (!copiedSectionAdjustments || copiedSectionAdjustments.section !== sectionName) return;

      setAdjustments(prev => ({
        ...prev,
        ...copiedSectionAdjustments.values,
      }));
    };

    const handleReset = () => {
      const resetValues = {};
      for (const key of sectionKeys) {
        resetValues[key] = JSON.parse(JSON.stringify(INITIAL_ADJUSTMENTS[key]));
      }
      setAdjustments(prev => ({
        ...prev,
        ...resetValues,
      }));
    };

    const isPasteAllowed = copiedSectionAdjustments && copiedSectionAdjustments.section === sectionName;

    const pasteLabel = copiedSectionAdjustments
      ? `Paste ${copiedSectionAdjustments.section.charAt(0).toUpperCase() + copiedSectionAdjustments.section.slice(1)} Settings`
      : 'Paste Settings';

    const options = [
      { label: `Copy ${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)} Settings`, icon: Copy, onClick: handleCopy },
      {
        label: pasteLabel,
        icon: ClipboardPaste,
        onClick: handlePaste,
        disabled: !isPasteAllowed
      },
      { type: 'separator' },
      { label: `Reset ${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)} Settings`, icon: RotateCcw, onClick: handleReset },
    ];

    showContextMenu(event.clientX, event.clientY, options);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex justify-between items-center flex-shrink-0 border-b border-surface">
        <h2 className="text-xl font-bold text-primary text-shadow-shiny">Adjustments</h2>
        <button
          onClick={handleResetAdjustments}
          disabled={!selectedImage}
          className="p-2 rounded-full hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Reset All Adjustments"
        >
          <RotateCcw size={18} />
        </button>
      </div>
      <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-2">
        <div className="flex-shrink-0">
          <CollapsibleSection
            title="Basic"
            isOpen={collapsibleState.basic}
            onToggle={() => handleToggleSection('basic')}
            onContextMenu={(e) => handleSectionContextMenu(e, 'basic')}
          >
            <BasicAdjustments adjustments={adjustments} setAdjustments={setAdjustments} />
          </CollapsibleSection>
        </div>
        <div className="flex-shrink-0">
          <CollapsibleSection
            title="Curves"
            isOpen={collapsibleState.curves}
            onToggle={() => handleToggleSection('curves')}
            onContextMenu={(e) => handleSectionContextMenu(e, 'curves')}
          >
            <CurveGraph
              adjustments={adjustments}
              setAdjustments={setAdjustments}
              histogram={histogram}
            />
          </CollapsibleSection>
        </div>
        <div className="flex-shrink-0">
          <CollapsibleSection
            title="Color"
            isOpen={collapsibleState.color}
            onToggle={() => handleToggleSection('color')}
            onContextMenu={(e) => handleSectionContextMenu(e, 'color')}
          >
            <ColorPanel adjustments={adjustments} setAdjustments={setAdjustments} />
          </CollapsibleSection>
        </div>
        <div className="flex-shrink-0">
          <CollapsibleSection
            title="Details"
            isOpen={collapsibleState.details}
            onToggle={() => handleToggleSection('details')}
            onContextMenu={(e) => handleSectionContextMenu(e, 'details')}
          >
            <DetailsPanel adjustments={adjustments} setAdjustments={setAdjustments} />
          </CollapsibleSection>
        </div>
        <div className="flex-shrink-0">
          <CollapsibleSection
            title="Effects"
            isOpen={collapsibleState.effects}
            onToggle={() => handleToggleSection('effects')}
            onContextMenu={(e) => handleSectionContextMenu(e, 'effects')}
          >
            <EffectsPanel adjustments={adjustments} setAdjustments={setAdjustments} />
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}