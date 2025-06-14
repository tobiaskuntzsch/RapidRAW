import { useState } from 'react';
import { Folder, Image as ImageIcon, RefreshCw } from 'lucide-react';
import Button from './ui/Button';
import FolderTree from './FolderTree';

function Thumbnail({ path, data, onDoubleClick }) {
  return (
    <div
      onClick={() => onDoubleClick(path)}
      className="aspect-square bg-surface rounded-md overflow-hidden cursor-pointer group relative hover:ring-2 hover:ring-hover-color transition-all duration-150"
      title={path.split(/[\\/]/).pop()}
    >
      {data ? (
        <img
          src={data}
          alt={path}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-surface">
          <ImageIcon className="text-text-secondary animate-pulse" />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="text-white text-xs truncate">{path.split(/[\\/]/).pop()}</p>
      </div>
    </div>
  );
}

export default function MainLibrary({
  imageList,
  onImageSelect,
  rootPath,
  currentFolderPath,
  folderTree,
  onFolderSelect,
  onOpenFolder,
  isTreeLoading,
  thumbnails
}) {
  const [isFolderTreeVisible, setIsFolderTreeVisible] = useState(true);

  if (!rootPath) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-bg-primary p-8 text-center">
        <ImageIcon size={80} className="text-accent opacity-20 mb-6" />
        <h1 className="text-3xl font-bold text-primary mb-2">RapidRAW</h1>
        <p className="text-text-secondary mb-8">Open a folder to start editing your images.</p>
        <Button onClick={onOpenFolder} size="lg" className="rounded-md">
          <Folder size={24} /> Open Folder
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-row flex-grow h-full min-h-0 gap-2">
      <FolderTree
        tree={folderTree}
        onFolderSelect={onFolderSelect}
        selectedPath={currentFolderPath}
        isLoading={isTreeLoading}
        isVisible={isFolderTreeVisible}
        setIsVisible={setIsFolderTreeVisible}
      />
      <div className="flex-1 flex flex-col h-full min-w-0 bg-bg-secondary rounded-lg overflow-hidden">
        <header className="p-4 flex-shrink-0 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-accent text-shadow-shiny">Library</h2>
            <p className="text-sm text-text-secondary truncate">{currentFolderPath}</p>
          </div>
          <Button onClick={onOpenFolder} className="rounded-md">
            <RefreshCw size={16} /> Change Root Folder
          </Button>
        </header>
        {imageList.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-text-secondary">
            <p>No images found in this folder.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
              {imageList.map((path) => (
                <Thumbnail
                  key={path}
                  path={path}
                  data={thumbnails[path]}
                  onDoubleClick={onImageSelect}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}