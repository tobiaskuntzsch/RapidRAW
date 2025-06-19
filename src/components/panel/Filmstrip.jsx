import { useEffect, useRef } from 'react';
import { Image as ImageIcon } from 'lucide-react';

export default function Filmstrip({ 
  imageList, 
  selectedImage, 
  onImageSelect, 
  thumbnails,
  multiSelectedPaths
}) {
  const filmstripRef = useRef(null);

  // Effect to handle horizontal scrolling with the mouse wheel
  useEffect(() => {
    const element = filmstripRef.current;
    if (!element) return;

    const onWheel = (e) => {
      // We prevent the default vertical scroll and scroll horizontally instead.
      e.preventDefault();
      element.scrollLeft += e.deltaY;
    };

    element.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      element.removeEventListener('wheel', onWheel);
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect to scroll the currently selected image into view
  useEffect(() => {
    if (selectedImage && filmstripRef.current) {
      const selectedIndex = imageList.findIndex(path => path === selectedImage.path);

      if (selectedIndex !== -1) {
        // The scrollable div has one child: the flex container for the images
        const flexContainer = filmstripRef.current.children[0];
        const activeElement = flexContainer?.children[selectedIndex];

        if (activeElement) {
          // A small timeout ensures the scroll happens after the element is fully rendered,
          // which is useful for the initial load.
          setTimeout(() => {
            activeElement.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
              inline: 'center',
            });
          }, 100);
        }
      }
    }
  }, [selectedImage, imageList]); // Re-run whenever the selected image or image list changes

  return (
    <div ref={filmstripRef} className="h-full overflow-x-auto overflow-y-hidden p-1">
      <div className="flex h-full gap-2">
        {imageList.map((path) => {
          const isActive = selectedImage?.path === path;
          const isSelected = multiSelectedPaths.includes(path);
          const thumbData = thumbnails[path];
          
          const ringClass = isActive
            ? 'ring-2 ring-accent'
            : isSelected
            ? 'ring-2 ring-gray-400'
            : 'hover:ring-2 hover:ring-hover-color';

          return (
            <div
              key={path}
              onClick={(e) => onImageSelect(path, e)}
              className={`h-full aspect-square rounded-md overflow-hidden cursor-pointer flex-shrink-0 group relative transition-all duration-150 ${ringClass}`}
            >
              {thumbData ? (
                <img
                  src={thumbData}
                  alt={path.split(/[\\/]/).pop()}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-surface">
                  <ImageIcon size={24} className="text-text-secondary animate-pulse" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}