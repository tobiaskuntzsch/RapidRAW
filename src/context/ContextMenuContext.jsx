import { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ContextMenuContext = createContext();

export function useContextMenu() {
  return useContext(ContextMenuContext);
}

// This is the visual component for the menu
function ContextMenu() {
  const { menuState, hideContextMenu, menuRef } = useContextMenu();
  const { isVisible, x, y, options } = menuState;

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1, ease: 'easeOut' }}
          className="fixed z-50"
          style={{ top: y, left: x }}
          onContextMenu={(e) => e.preventDefault()} // Prevent nested context menus
        >
          <div
            className="bg-surface rounded-lg shadow-xl p-2 w-64"
            role="menu"
            aria-orientation="vertical"
          >
            {options.map((option, index) => (
              <button
                key={index}
                onClick={() => {
                  if (!option.disabled) {
                    option.onClick();
                    hideContextMenu();
                  }
                }}
                disabled={option.disabled}
                className={`
                  w-full text-left px-3 py-2 text-sm rounded-md flex items-center gap-3
                  transition-colors duration-150
                  ${option.isDestructive ? 'text-red-400 hover:bg-red-500/20' : 'text-text-primary hover:bg-bg-primary'}
                  ${option.disabled ? 'text-text-secondary bg-transparent cursor-not-allowed' : ''}
                `}
                role="menuitem"
              >
                {option.icon && <option.icon size={16} />}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


export function ContextMenuProvider({ children }) {
  const [menuState, setMenuState] = useState({
    isVisible: false,
    x: 0,
    y: 0,
    options: [],
  });
  const menuRef = useRef(null);

  const showContextMenu = useCallback((x, y, options) => {
    setMenuState({ isVisible: true, x, y, options });
  }, []);

  const hideContextMenu = useCallback(() => {
    setMenuState((prev) => ({ ...prev, isVisible: false }));
  }, []);

  // Effect to handle clicking outside the menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        hideContextMenu();
      }
    };

    if (menuState.isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      // Also hide on scroll
      window.addEventListener('scroll', hideContextMenu, true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', hideContextMenu, true);
    };
  }, [menuState.isVisible, hideContextMenu]);

  const value = {
    menuState,
    showContextMenu,
    hideContextMenu,
    menuRef, // Pass ref to be used by the ContextMenu component
  };

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
      <ContextMenu /> 
    </ContextMenuContext.Provider>
  );
}