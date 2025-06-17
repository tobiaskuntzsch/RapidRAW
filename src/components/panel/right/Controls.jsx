import { RotateCcw } from 'lucide-react';
import BasicAdjustments from '../../adjustments/BasicAdjustments';
import CurveGraph from '../../adjustments/CurveGraph';
import ColorPanel from '../../adjustments/ColorPanel';
import CollapsibleSection from '../../ui/CollapsibleSection';
import { INITIAL_ADJUSTMENTS } from '../../../App';

export default function Controls({ adjustments, setAdjustments, selectedImage, histogram }) {

  const handleResetAdjustments = () => {
    setAdjustments(INITIAL_ADJUSTMENTS);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex justify-between items-center flex-shrink-0">
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
          <CollapsibleSection title="Basic" defaultOpen={true}>
            <BasicAdjustments adjustments={adjustments} setAdjustments={setAdjustments} />
          </CollapsibleSection>
        </div>
        <div className="flex-shrink-0">
          <CollapsibleSection title="Curves" defaultOpen={false}>
            <CurveGraph 
              adjustments={adjustments} 
              setAdjustments={setAdjustments} 
              histogram={histogram} 
            />
          </CollapsibleSection>
        </div>
        <div className="flex-shrink-0">
          <CollapsibleSection title="Color" defaultOpen={false}>
            <ColorPanel adjustments={adjustments} setAdjustments={setAdjustments} />
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
}