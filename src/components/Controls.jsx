// src/components/Controls.jsx

import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { Save } from 'lucide-react';
import BasicAdjustments from './BasicAdjustments';
import CurveGraph from './CurveGraph';
import HSL from './HSL';

export default function Controls({ adjustments, setAdjustments, processedImageUrl, selectedImage }) {

  // Renamed to handleExportImage for clarity
  const handleExportImage = async () => {
    if (!selectedImage) {
      alert("Please select an image to export.");
      return;
    }

    try {
      // Suggest a filename for the user
      const originalFilename = selectedImage.path.split(/[\\/]/).pop();
      const [name] = originalFilename.split('.');
      
      const filePath = await save({
        title: "Save Edited Image",
        defaultPath: `${name}_edited.png`, // User can still choose other formats
        filters: [{ 
          name: 'PNG Image', 
          extensions: ['png'] 
        }, {
          name: 'JPEG Image',
          extensions: ['jpg', 'jpeg']
        }]
      });

      if (filePath) {
        // --- THIS IS THE KEY CHANGE ---
        // Call the new `export_image` command on the backend.
        // We send the desired path and the final adjustment values.
        // The backend will process the FULL-RESOLUTION image.
        try {
          await invoke('export_image', { 
            path: filePath, 
            jsAdjustments: adjustments // Send the whole adjustments object
          });
          alert(`Image saved to ${filePath}`);
        } catch (error) {
          console.error('Error exporting image:', error);
          alert(`Failed to save image: ${error}`);
        }
      }
    } catch (error) {
      console.error('Dialog error:', error);
      // This can happen if the user cancels the dialog, so a silent fail is okay.
    }
  };

  return (
    <div className="panel-right">
      <div className="p-4 border-b border-border-color flex justify-between items-center">
        <h2 className="panel-title mb-0">Adjustments</h2>
        <button
          onClick={handleExportImage}
          disabled={!selectedImage} // Disable if no image is selected
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