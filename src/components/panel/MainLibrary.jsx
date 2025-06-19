import { useState, useEffect } from 'react';
import { Folder, Image as ImageIcon, RefreshCw, Settings, Home } from 'lucide-react';
import Button from '../ui/Button';
import FolderTree from '../panel/FolderTree';
import SettingsPanel from './SettingsPanel';

function Thumbnail({ path, data, onImageClick, onImageDoubleClick, isSelected, isActive }) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (data) {
      setIsLoaded(true);
    }
  }, [data]);

  const ringClass = isActive
    ? 'ring-2 ring-accent'
    : isSelected
    ? 'ring-2 ring-gray-400'
    : 'hover:ring-2 hover:ring-hover-color';

  return (
    <div
      onClick={(e) => {
        e.stopPropagation(); // Prevent click from bubbling to the library background
        onImageClick(path, e);
      }}
      onDoubleClick={() => onImageDoubleClick(path)}
      className={`aspect-square bg-surface rounded-md overflow-hidden cursor-pointer group relative transition-all duration-150 ${ringClass}`}
      title={path.split(/[\\/]/).pop()}
    >
      {data ? (
        <img
          src={data}
          alt={path}
          className={`
            w-full h-full object-cover
            group-hover:scale-[1.02]
            transition ease-in-out duration-300
            ${isLoaded ? 'opacity-100' : 'opacity-0'}
          `}
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
  onImageClick,
  onImageDoubleClick,
  multiSelectedPaths,
  activePath,
  rootPath,
  currentFolderPath,
  onOpenFolder,
  thumbnails,
  appSettings,
  onContinueSession,
  onGoHome,
  onClearSelection, // Accept the new prop
}) {
  const [showSettings, setShowSettings] = useState(false);

  if (!rootPath) {
    if (!appSettings) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center h-full rounded-lg bg-bg-primary p-8 text-center">
          <ImageIcon size={80} className="text-accent opacity-20 mb-6 animate-pulse" />
          <h1 className="text-3xl font-bold text-primary mb-2">RapidRAW</h1>
          <p className="text-text-secondary mb-8">Loading settings...</p>
        </div>
      );
    }

    const hasLastPath = !!appSettings.last_root_path;

    return (
      <div className="flex-1 flex h-full rounded-lg bg-bg-secondary overflow-hidden shadow-lg">
        <div className="w-1/2 hidden md:block relative">
          <img
            src="/splash.jpg"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-bg-secondary via-bg-secondary/50 to-transparent"></div>
        </div>

        <div className="w-full md:w-1/2 flex flex-col p-8 lg:p-16 relative">
          {showSettings ? (
            <SettingsPanel
              onBack={() => setShowSettings(false)}
              appSettings={appSettings}
            />
          ) : (
            <>
              <div className="my-auto text-left">
                <h1 className="text-5xl font-bold text-primary text-shadow-shiny mb-4">
                  RapidRAW
                </h1>
                <p className="text-text-secondary mb-10 max-w-md">
                  {hasLastPath ? (
                    <>
                      Welcome back!<br />
                      Continue where you left off or start a new session.
                    </>
                  ) : (
                    "A blazingly fast, GPU-accelerated RAW image editor. Open a folder to begin."
                  )}
                </p>
                <div className="flex flex-col w-full max-w-xs gap-4">
                  {hasLastPath && (
                    <Button onClick={onContinueSession} size="lg" className="rounded-md h-11 w-full flex justify-start items-center">
                      <RefreshCw size={20} className="mr-2" /> Continue Session
                    </Button>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={onOpenFolder}
                      size="lg"
                      className={`rounded-md flex-grow flex justify-start items-center h-11 ${hasLastPath ? 'bg-surface text-text-primary shadow-none' : ''}`}
                    >
                      <Folder size={20} className="mr-2" />
                      {hasLastPath ? "Change Folder" : "Open Folder"}
                    </Button>
                    <Button 
                      onClick={() => setShowSettings(true)} 
                      size="lg" 
                      variant="ghost" 
                      className="px-3 bg-surface text-text-primary shadow-none h-11"
                    >
                      <Settings size={20} />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="absolute bottom-8 left-8 lg:left-16 text-xs text-text-secondary">Version 1.0.0 - Image by Mahdi Bafande</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-bg-secondary rounded-lg overflow-hidden">
      <header className="p-4 flex-shrink-0 flex justify-between items-center border-b border-border-color">
        <div>
          <h2 className="text-2xl font-bold text-primary">Library</h2>
          <p className="text-sm text-text-secondary truncate">{currentFolderPath}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onOpenFolder} className="bg-surface text-text-primary shadow-none aspect-square">
            <Folder size={18} />
          </Button>
          <Button onClick={onGoHome} className="bg-surface text-text-primary shadow-none aspect-square">
            <Home size={18} />
          </Button>
        </div>
      </header>
      {imageList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-secondary">
          <p>No images found in this folder.</p>
        </div>
      ) : (
        <div 
          className="flex-1 overflow-y-auto p-4"
          onClick={onClearSelection}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {imageList.map((path) => (
              <Thumbnail
                key={path}
                path={path}
                data={thumbnails[path]}
                onImageClick={onImageClick}
                onImageDoubleClick={onImageDoubleClick}
                isSelected={multiSelectedPaths.includes(path)}
                isActive={activePath === path}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}