import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CollapsibleSection({ title, children, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef(null);
  const wrapperRef = useRef(null);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;

    const updateMaxHeight = () => {
      if (isOpen) {
        const contentHeight = content.scrollHeight;
        wrapper.style.maxHeight = `${contentHeight}px`;
      } else {
        wrapper.style.maxHeight = '0px';
      }
    };

    updateMaxHeight();

    const resizeObserver = new ResizeObserver(updateMaxHeight);
    resizeObserver.observe(content);

    return () => resizeObserver.disconnect();

  }, [isOpen]);

  return (
    <div className="bg-surface rounded-lg overflow-hidden flex-shrink-0">
      <button
        onClick={toggleOpen}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-card-active transition-colors duration-200"
      >
        <h3 className="text-lg font-normal text-primary text-shadow-shiny">{title}</h3>
        <ChevronDown 
          size={20} 
          className={`text-accent transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        ref={wrapperRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
      >
        <div ref={contentRef} className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}