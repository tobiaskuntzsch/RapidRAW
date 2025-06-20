import { useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { Save } from 'lucide-react';

export default function ExportPanel({ selectedImage, adjustments }) {
  const [demosaicQuality, setDemosaicQuality] = useState('Menon');

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
            jsAdjustments: adjustments,
            demosaicQuality: selectedImage.isRaw ? demosaicQuality : null,
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
    <div className="flex flex-col h-full">
      <div className="p-4 flex justify-between items-center flex-shrink-0 border-b border-surface">
        <h2 className="text-xl font-bold text-primary text-shadow-shiny">Export</h2>
      </div>
      <div className="flex-grow overflow-y-auto p-4 text-text-secondary">
        {selectedImage ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <p className="text-center">Export the final image with all adjustments applied.</p>
            
            {selectedImage.isRaw && (
              <div className="w-full max-w-xs">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  RAW Demosaic Quality
                </label>
                <select
                  value={demosaicQuality}
                  onChange={(e) => setDemosaicQuality(e.target.value)}
                  className="w-full bg-bg-primary border border-surface rounded-md p-2 text-text-primary focus:ring-accent focus:border-accent"
                >
                  <option value="Menon">High Quality</option>
                  <option value="Linear">Fast</option>
                </select>
              </div>
            )}

            <button
              onClick={handleExportImage}
              disabled={!selectedImage}
              className="flex items-center gap-2 px-4 py-2 bg-bg-primary text-white font-bold rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={18} />
              Export Image
            </button>
          </div>
        ) : (
          <p>No image selected.</p>
        )}
      </div>
    </div>
  );
}