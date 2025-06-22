import { RotateCcw } from 'lucide-react';
import BasicAdjustments from '../../adjustments/BasicAdjustments';
import CurveGraph from '../../adjustments/CurveGraph';
import ColorPanel from '../../adjustments/ColorPanel';
import DetailsPanel from '../../adjustments/DetailsPanel';
import EffectsPanel from '../../adjustments/EffectsPanel';
import CollapsibleSection from '../../ui/CollapsibleSection';
import { INITIAL_ADJUSTMENTS } from '../../../App';

export default function Controls({
  adjustments,
  setAdjustments,
  selectedImage,
  histogram,
  collapsibleState,
  setCollapsibleState
}) {

  const handleResetAdjustments = () => {
    const currentRating = adjustments.rating;
    setAdjustments({ ...INITIAL_ADJUSTMENTS, rating: currentRating });
  };

  const handleToggleSection = (section) => {
    setCollapsibleState(prev => ({ ...prev, [section]: !prev[section] }));
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
          >
            <BasicAdjustments adjustments={adjustments} setAdjustments={setAdjustments} />
          </CollapsibleSection>
        </div>
        <div className="flex-shrink-0">
          <CollapsibleSection
            title="Curves"
            isOpen={collapsibleState.curves}
            onToggle={() => handleToggleSection('curves')}
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
          >
            <ColorPanel adjustments={adjustments} setAdjustments={setAdjustments} />
          </CollapsibleSection>
        </div>
        <div className="flex-shrink-0">
          <CollapsibleSection
            title="Details"
            isOpen={collapsibleState.details}
            onToggle={() => handleToggleSection('details')}
          >
            <DetailsPanel adjustments={adjustments} setAdjustments={setAdjustments} />
          </CollapsibleSection>
        </div>
        <div className="flex-shrink-0">
          <CollapsibleSection
            title="Effects"
            isOpen={collapsibleState.effects}
            onToggle={() => handleToggleSection('effects')}
          >
            <EffectsPanel adjustments={adjustments} setAdjustments={setAdjustments} />
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}