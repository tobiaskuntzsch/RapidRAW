import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { Save } from 'lucide-react';
import BasicAdjustments from './BasicAdjustments';
import CurveGraph from './CurveGraph';
import Button from './ui/Button';
import HSL from './HSL';

export default function Controls({ adjustments, setAdjustments, selectedImage }) {

  const handleExportImage = async () => {
    if (!selectedImage) {
      alert("Please select an image to export.");
      return;
    }

    try {
      const originalFilename = selectedImage.path.split(/[\\/]/).pop();
      const [name] = originalFilename.split('.');
      
      const filePath = await save({
        title: "Save Edited Image",
        defaultPath: `${name}_edited.png`,
        filters: [{ 
          name: 'PNG Image', 
          extensions: ['png'] 
        }, {
          name: 'JPEG Image',
          extensions: ['jpg', 'jpeg']
        }]
      });

      if (filePath) {
        try {
          await invoke('export_image', { 
            path: filePath, 
            jsAdjustments: adjustments
          });
          alert(`Image saved to ${filePath}`);
        } catch (error) {
          console.error('Error exporting image:', error);
          alert(`Failed to save image: ${error}`);
        }
      }
    } catch (error) {
      console.error('Dialog error:', error);
    }
  };

  return (
    <div className="w-80 bg-bg-secondary flex flex-col border-l border-border-color/30">
      <div className="p-4 border-b border-border-color/30 flex justify-between items-center">
        {/* Title: Bold and "white" (accent color) */}
        <h2 className="text-xl font-bold text-accent text-shadow-shiny">Adjustments</h2>
        {/* Shiny Button */}
        <Button
          onClick={handleExportImage}
          disabled={!selectedImage}
        >
          <Save size={18} /> Export
        </Button>
      </div>
      <div className="flex-grow overflow-y-auto p-4">
        <BasicAdjustments adjustments={adjustments} setAdjustments={setAdjustments} />
        <CurveGraph adjustments={adjustments} setAdjustments={setAdjustments} />
        <HSL adjustments={adjustments} setAdjustments={setAdjustments} />
      </div>
    </div>
  );
}