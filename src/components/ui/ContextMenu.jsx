import { useEffect, useRef } from 'react';
import { useContextMenu } from '../../context/ContextMenuContext';

export default function ContextMenu() {
  const { isVisible, x, y, options, hideContextMenu } = useContextMenu();
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        hideContextMenu();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, hideContextMenu]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-40 bg-surface rounded-lg shadow-xl p-2"
      style={{ top: y, left: x }}
    >
      <ul className="flex flex-col">
        {options.map((option, index) => (
          <li key={index}>
            <button
              onClick={() => {
                option.onClick();
                hideContextMenu();
              }}
              className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                option.isDestructive 
                  ? 'text-red-500 hover:bg-red-500/20' 
                  : 'text-text-primary hover:bg-card-active'
              }`}
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}