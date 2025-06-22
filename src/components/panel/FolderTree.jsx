import { useState, useEffect } from 'react';
import { Folder, FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

function TreeNode({ node, onFolderSelect, selectedPath, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.path === selectedPath;

  useEffect(() => {
    if (selectedPath && selectedPath.startsWith(node.path) && selectedPath !== node.path) {
      setIsOpen(true);
    }
  }, [selectedPath, node.path]);

  const handleFolderIconClick = (e) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
  };

  const handleNameClick = () => {
    onFolderSelect(node.path);
  };

  return (
    <div className="text-sm">
      <div
        className={`flex items-center gap-2 p-1.5 rounded-md transition-colors ${
          isSelected ? 'bg-card-active' : 'hover:bg-surface'
        }`}
      >
        <div
          onClick={handleFolderIconClick}
          className={`cursor-pointer p-0.5 rounded hover:bg-surface ${hasChildren ? '' : 'cursor-default'}`}
        >
          {hasChildren ? (
            isOpen ? (
              <FolderOpen size={16} className="text-hover-color flex-shrink-0" />
            ) : (
              <Folder size={16} className="text-text-secondary flex-shrink-0" />
            )
          ) : (
            <Folder size={16} className="text-text-secondary flex-shrink-0" />
          )}
        </div>
        <span 
          onClick={handleNameClick}
          className="truncate select-none cursor-pointer flex-1"
        >
          {node.name}
        </span>
      </div>

      {hasChildren && isOpen && (
        <div className="pl-4 border-l border-border-color/20 ml-2 py-1">
          {node.children.map((childNode) => (
            <TreeNode
              key={childNode.path}
              node={childNode}
              onFolderSelect={onFolderSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FolderTree({ tree, onFolderSelect, selectedPath, isLoading, isVisible, setIsVisible, style, isResizing }) {
  return (
    <div
      className={clsx(
        'relative bg-bg-secondary rounded-lg flex-shrink-0',
        !isResizing && 'transition-[width] duration-300 ease-in-out'
      )}
      style={style}
    >
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="absolute top-1/2 -translate-y-1/2 right-1 w-6 h-10 hover:bg-card-active rounded-md flex items-center justify-center z-10"
        title={isVisible ? "Collapse Panel" : "Expand Panel"}
      >
        {isVisible ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {isVisible && (
        <div className="p-2  flex flex-col overflow-y-auto h-full">
          {isLoading && (
            <p className="text-text-secondary text-sm animate-pulse p-2">Loading folder structure...</p>
          )}
          {!isLoading && !tree && (
            <p className="text-text-secondary text-sm p-2">Open a folder to see its structure.</p>
          )}
          {!isLoading && tree && (
            <>
              <TreeNode 
                node={tree} 
                onFolderSelect={onFolderSelect} 
                selectedPath={selectedPath} 
                defaultOpen={true} 
              />
              {tree.children.length === 0 && (
                <div className="text-xs text-text-secondary mt-2 px-2">
                  No subfolders found.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}