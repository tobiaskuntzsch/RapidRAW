import { SlidersHorizontal, Info, Scaling, Sparkles, Bookmark, Save } from 'lucide-react';

const panelOptions = [
  { id: 'metadata', icon: Info, title: 'Metadata' },
  { id: 'adjustments', icon: SlidersHorizontal, title: 'Adjustments' },
  { id: 'crop', icon: Scaling, title: 'Crop' },
  { id: 'presets', icon: Bookmark, title: 'Presets' },
  { id: 'ai', icon: Sparkles, title: 'AI Tools' },
  { id: 'export', icon: Save, title: 'Export' },
];

export default function RightPanelSwitcher({ activePanel, onPanelSelect }) {
  return (
    <div className="flex flex-col bg-bg-secondary rounded-lg p-1 gap-1 h-full">
      {panelOptions.map(({ id, icon: Icon, title }) => (
        <button
          key={id}
          onClick={() => onPanelSelect(id)}
          title={title}
          className={`p-2 rounded-md transition-colors duration-200 ${
            activePanel === id
              ? 'bg-surface text-white'
              : 'text-text-secondary hover:bg-surface hover:text-text-primary'
          }`}
        >
          <Icon size={20} />
        </button>
      ))}
    </div>
  );
}