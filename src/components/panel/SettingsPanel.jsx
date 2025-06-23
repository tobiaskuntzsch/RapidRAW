import { useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import Button from '../ui/Button';
import ConfirmModal from '../modals/ConfirmModal';
import Dropdown from '../ui/Dropdown';

const resolutions = [
  { value: 720, label: '720px' },
  { value: 1280, label: '1280px' },
  { value: 1920, label: '1920px' },
  { value: 2560, label: '2560px' },
  { value: 3840, label: '3840px' },
];

export default function SettingsPanel({ onBack, appSettings, onSettingsChange, rootPath, onLibraryRefresh }) {
  const [isClearing, setIsClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState('');

  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheClearMessage, setCacheClearMessage] = useState('');

  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Confirm',
    confirmVariant: 'primary',
  });

  const effectiveRootPath = rootPath || appSettings?.last_root_path;

  const executeClearSidecars = async () => {
    setIsClearing(true);
    setClearMessage('Deleting sidecar files, please wait...');
    try {
      const count = await invoke('clear_all_sidecars', { rootPath: effectiveRootPath });
      setClearMessage(`${count} sidecar files deleted successfully.`);
      onLibraryRefresh();
    } catch (err) {
      console.error("Failed to clear sidecars:", err);
      setClearMessage(`Error: ${err}`);
    } finally {
      setTimeout(() => {
        setIsClearing(false);
        setClearMessage('');
      }, 3000);
    }
  };

  const handleClearSidecars = () => {
    setConfirmModalState({
      isOpen: true,
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete all sidecar files?\n\nThis will permanently remove all your edits for all images inside the current root folder and its subfolders.',
      onConfirm: executeClearSidecars,
      confirmText: 'Delete All Edits',
      confirmVariant: 'destructive',
    });
  };

  const executeClearCache = async () => {
    setIsClearingCache(true);
    setCacheClearMessage('Clearing thumbnail cache...');
    try {
      await invoke('clear_thumbnail_cache');
      setCacheClearMessage('Thumbnail cache cleared successfully.');
      onLibraryRefresh();
    } catch (err) {
      console.error("Failed to clear thumbnail cache:", err);
      setCacheClearMessage(`Error: ${err}`);
    } finally {
      setTimeout(() => {
        setIsClearingCache(false);
        setCacheClearMessage('');
      }, 3000);
    }
  };

  const handleClearCache = () => {
    setConfirmModalState({
      isOpen: true,
      title: 'Confirm Cache Deletion',
      message: 'Are you sure you want to clear the thumbnail cache?\n\nAll thumbnails will need to be regenerated, which may be slow for large folders.',
      onConfirm: executeClearCache,
      confirmText: 'Clear Cache',
      confirmVariant: 'destructive',
    });
  };

  const closeConfirmModal = () => {
    setConfirmModalState({ ...confirmModalState, isOpen: false });
  };

  return (
    <>
      <ConfirmModal
        {...confirmModalState}
        onClose={closeConfirmModal}
      />
      <div className="flex flex-col h-full w-full text-text-primary">
        <header className="flex-shrink-0 flex items-center mb-6">
          <Button onClick={onBack} variant="ghost" size="icon" className="mr-2 hover:bg-surface text-white rounded-full">
            <ArrowLeft />
          </Button>
          <h1 className="text-3xl font-bold text-primary">Settings</h1>
        </header>
        <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-8">
          
          {/* Editor Settings */}
          <div className="p-6 bg-surface rounded-xl shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-primary">Editor</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="preview-resolution" className="block text-sm font-medium text-text-secondary mb-2">
                  Preview Resolution
                </label>
                <Dropdown
                  options={resolutions}
                  value={appSettings?.editor_preview_resolution || 1920}
                  onChange={(value) => onSettingsChange({ ...appSettings, editor_preview_resolution: value })}
                />
                <p className="text-xs text-text-secondary mt-2">
                  Higher resolutions provide a sharper preview but may impact performance on less powerful systems.
                </p>
              </div>
            </div>
          </div>

          {/* Data Management */}
          <div className="p-6 bg-surface rounded-xl shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-primary">Data Management</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-text-primary">Clear All Sidecar Files</h3>
                <p className="text-xs text-text-secondary mt-1 mb-3">
                  This will delete all `.rrdata` files (containing your edits) within the current root folder:
                  <span className="block font-mono text-xs bg-bg-primary p-2 rounded mt-1 break-all">
                    {effectiveRootPath || 'No folder selected'}
                  </span>
                </p>
                <Button
                  variant="destructive"
                  onClick={handleClearSidecars}
                  disabled={isClearing || !effectiveRootPath}
                >
                  <Trash2 size={16} className="mr-2" />
                  {isClearing ? 'Clearing...' : 'Delete All Edits in Folder'}
                </Button>
                {clearMessage && (
                  <p className="text-sm text-accent mt-3">{clearMessage}</p>
                )}
              </div>
              <div className="pt-6 border-t border-border-color">
                <h3 className="font-medium text-text-primary">Clear Thumbnail Cache</h3>
                <p className="text-xs text-text-secondary mt-1 mb-3">
                  This will delete all cached thumbnail images. They will be regenerated automatically as you browse your library.
                </p>
                <Button
                  variant="destructive"
                  onClick={handleClearCache}
                  disabled={isClearingCache}
                >
                  <Trash2 size={16} className="mr-2" />
                  {isClearingCache ? 'Clearing...' : 'Clear Thumbnail Cache'}
                </Button>
                {cacheClearMessage && (
                  <p className="text-sm text-accent mt-3">{cacheClearMessage}</p>
                )}
              </div>
            </div>
          </div>

          {/* Information */}
          <div className="p-6 bg-surface rounded-xl shadow-md">
            <h2 className="text-xl font-semibold mb-2 text-primary">Information</h2>
            {appSettings?.last_root_path && (
              <div className="mt-4">
                <h3 className="font-medium text-text-primary">Last Used Folder</h3>
                <p className="text-sm text-text-secondary bg-bg-primary p-3 rounded-md mt-2 font-mono break-all">
                  {appSettings.last_root_path}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}