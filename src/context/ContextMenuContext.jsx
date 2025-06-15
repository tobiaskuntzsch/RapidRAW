import { createContext, useState, useContext, useCallback } from 'react';

const ContextMenuContext = createContext();

export function useContextMenu() {
  return useContext(ContextMenuContext);
}

export function ContextMenuProvider({ children }) {
  const [menuState, setMenuState] = useState({
    isVisible: false,
    x: 0,
    y: 0,
    options: [],
  });

  const showContextMenu = useCallback((x, y, options) => {
    setMenuState({ isVisible: true, x, y, options });
  }, []);

  const hideContextMenu = useCallback(() => {
    setMenuState((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const value = {
    ...menuState,
    showContextMenu,
    hideContextMenu,
  };

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
    </ContextMenuContext.Provider>
  );
}