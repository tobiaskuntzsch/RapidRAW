import { memo } from 'react';
import { Eye, EyeOff, ArrowLeft, Maximize, Loader2, Undo, Redo } from 'lucide-react';

const EditorToolbar = memo(({ onBackToLibrary, selectedImage, isLoading, onToggleShowOriginal, showOriginal, onToggleFullScreen, isFullScreenLoading, onUndo, onRedo, canUndo, canRedo }) => (
  <div className="flex-shrink-0 flex justify-between items-center px-1">
    <button onClick={onBackToLibrary} className="bg-surface text-text-primary p-2 rounded-full hover:bg-card-active transition-colors" title="Back to Library">
      <ArrowLeft size={20} />
    </button>
    <div className="bg-surface text-text-secondary text-xs px-4 py-2 rounded-full select-none truncate flex items-center gap-2">
      <span className="font-medium text-text-primary truncate">{selectedImage.path.split(/[\/\\]/).pop()}</span>
      {isLoading && <Loader2 size={12} className="animate-spin" />}
      {selectedImage.width > 0 && ` - ${selectedImage.width} × ${selectedImage.height}`}
    </div>
    <div className="flex items-center gap-2">
      <button onClick={onUndo} disabled={!canUndo} className="bg-surface text-text-primary p-2 rounded-full hover:bg-card-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Undo (Ctrl+Z)">
        <Undo size={20} />
      </button>
      <button onClick={onRedo} disabled={!canRedo} className="bg-surface text-text-primary p-2 rounded-full hover:bg-card-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Redo (Ctrl+Y)">
        <Redo size={20} />
      </button>
      <button onClick={onToggleShowOriginal} className="bg-surface text-text-primary p-2 rounded-full hover:bg-card-active transition-colors" title={showOriginal ? "Show Edited (.)" : "Show Original (.)"}>
        {showOriginal ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
      <button onClick={onToggleFullScreen} className="bg-surface text-text-primary p-2 rounded-full hover:bg-card-active transition-colors" title="Toggle Fullscreen (F)" disabled={isFullScreenLoading}>
        {isFullScreenLoading ? <Loader2 size={20} className="animate-spin" /> : <Maximize size={20} />}
      </button>
    </div>
  </div>
));

export default EditorToolbar;