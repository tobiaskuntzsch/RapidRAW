import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { homeDir } from '@tauri-apps/api/path';
import { Folder, Image as ImageIcon } from 'lucide-react';

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
    <div className="panel-left">
      <h2 className="panel-title">Library</h2>
      <button onClick={handleOpenLibrary} className="btn btn-primary mb-4">
        <Folder size={20} /> Open Folder
      </button>
      <div className="flex-grow overflow-y-auto pr-1">
        {imageList.length === 0 ? (
          <p className="text-text-secondary text-sm">Select a folder to see images.</p>
        ) : (
          <ul>
            {imageList.map((imagePath) => (
              <li
                key={imagePath}
                onClick={() => onImageSelect(imagePath)}
                className="library-item"
              >
                <ImageIcon size={16} className="library-item-icon" />
                <span className="library-item-text">{imagePath.split(/[\\/]/).pop()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}