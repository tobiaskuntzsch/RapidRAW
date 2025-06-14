import { useState, useEffect } from 'react';
import { Folder, FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react';

function TreeNode({ node, onFolderSelect, selectedPath }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.path === selectedPath;

  useEffect(() => {
    if (selectedPath && selectedPath.startsWith(node.path) && selectedPath !== node.path) {
      setIsOpen(true);
    }
  }, [selectedPath, node.path]);

  const handleClick = () => {
    onFolderSelect(node.path);
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="text-sm">
      <div
        onClick={handleClick}
        className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer hover:bg-surface transition-colors ${
          isSelected ? 'bg-card-active' : ''
        }`}
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
        <span className="truncate select-none">{node.name}</span>
      </div>

      {hasChildren && (
        <div
          className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${isOpen ? 'max-h-[1000px]' : 'max-h-0'}`}
        >
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
        </div>
      )}
    </div>
  );
}

export default function FolderTree({ tree, onFolderSelect, selectedPath, isLoading, isVisible, setIsVisible }) {
  return (
    <div
      className={`relative bg-bg-secondary rounded-lg flex-shrink-0 transition-[width] duration-300 ease-in-out ${
        isVisible ? 'w-64' : 'w-8'
      }`}
    >
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="absolute top-1/2 -translate-y-1/2 right-1 w-6 h-10 bg-surface hover:bg-card-active rounded-md flex items-center justify-center z-10"
        title={isVisible ? "Collapse Panel" : "Expand Panel"}
      >
        {isVisible ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {isVisible && (
        // The pr-3 for scrollbar padding has been removed, and classes to hide the scrollbar have been added.
        <div className="p-2 flex flex-col overflow-y-auto h-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isLoading && (
            <p className="text-text-secondary text-sm animate-pulse p-2">Loading folder structure...</p>
          )}
          {!isLoading && !tree && (
            <p className="text-text-secondary text-sm p-2">Open a folder to see its structure.</p>
          )}
          {!isLoading && tree && (
            <>
              <TreeNode node={tree} onFolderSelect={onFolderSelect} selectedPath={selectedPath} />
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