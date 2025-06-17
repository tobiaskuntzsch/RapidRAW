import { ArrowLeft } from 'lucide-react';
import Button from '../ui/Button';

export default function SettingsPanel({ onBack, appSettings }) {
  return (
    // This component is now designed to fit inside another container
    <div className="flex flex-col h-full w-full">
      <header className="flex-shrink-0 flex items-center mb-8 -ml-2">
        <Button onClick={onBack} variant="ghost" size="icon" className="mr-2">
          <ArrowLeft />
        </Button>
        <h1 className="text-2xl font-bold text-primary">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto pr-4 -mr-4">
        <div className="space-y-8">
          <div className="p-6 bg-surface rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Application Settings</h2>
            <p className="text-text-secondary">
              More settings will be available here in future updates.
            </p>
          </div>

          <div className="p-6 bg-surface rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Information</h2>
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
    </div>
  );
}