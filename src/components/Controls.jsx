import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { Save } from 'lucide-react';
import BasicAdjustments from './BasicAdjustments';
import CurveGraph from './CurveGraph';
import HSL from './HSL';

export default function Controls({ adjustments, setAdjustments, processedImageUrl, selectedImage }) {

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
    <div className="panel-right">
      <div className="p-4 border-b border-border-color flex justify-between items-center">
        <h2 className="panel-title mb-0">Adjustments</h2>
        <button
          onClick={handleExportImage}
          disabled={!selectedImage}
          className="btn bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          <Save size={18} /> Export
        </button>
      </div>
      <div className="flex-grow overflow-y-auto">
        <BasicAdjustments adjustments={adjustments} setAdjustments={setAdjustments} />
        <CurveGraph adjustments={adjustments} setAdjustments={setAdjustments} />
        <HSL adjustments={adjustments} setAdjustments={setAdjustments} />
      </div>
    </div>
  );
}