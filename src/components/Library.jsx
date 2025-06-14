import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { homeDir } from '@tauri-apps/api/path';
import { Folder, Image as ImageIcon } from 'lucide-react';
import Button from './ui/Button';

export default function Library({ imageList, setImageList, onImageSelect }) {
  const handleOpenLibrary = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        defaultPath: await homeDir(),
      });

      if (typeof selectedPath === 'string') {
        try {
          const files = await invoke('list_images_in_dir', { path: selectedPath });
          setImageList(files);
        } catch (error) {
          console.error("Failed to list images:", error);
          alert("Failed to load images from the selected folder.");
        }
      }
    } catch (error) {
      console.error("Failed to open directory dialog:", error);
      alert("Failed to open folder selection dialog.");
    }
  };

  return (
    // Re-created the 'panel-left' styles using Tailwind utilities
    <div className="w-64 bg-bg-secondary p-4 flex flex-col border-r border-border-color/30">
      {/* Styled the title to be shiny */}
      <h2 className="text-xl font-bold text-accent text-shadow-shiny mb-4">Library</h2>
      
      <Button onClick={handleOpenLibrary} className="mb-4">
        <Folder size={20} /> Open Folder
      </Button>
      
      <div className="flex-grow overflow-y-auto pr-1">
        {imageList.length === 0 ? (
          <p className="text-text-secondary text-sm">Select a folder to see images.</p>
        ) : (
          <ul>
            {imageList.map((imagePath) => (
              <li
                key={imagePath}
                onClick={() => onImageSelect(imagePath)}
                // Re-created the 'library-item' styles using Tailwind utilities
                className="p-2 hover:bg-surface cursor-pointer rounded-md flex items-center gap-3 transition-colors duration-150 mb-1"
              >
                {/* Styled the icon and text */}
                <ImageIcon size={16} className="text-text-secondary flex-shrink-0" />
                <span className="truncate text-sm text-text-primary">{imagePath.split(/[\\/]/).pop()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}