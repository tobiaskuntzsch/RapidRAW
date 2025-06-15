import { ChevronUp, ChevronDown, Image as ImageIcon } from 'lucide-react';

export default function Filmstrip({ 
  imageList, 
  selectedImage, 
  onImageSelect, 
  isVisible, 
  setIsVisible,
  thumbnails
}) {

  return (
    <div
      className={`bg-bg-secondary rounded-lg flex-shrink-0 transition-all duration-300 ease-in-out ${isVisible ? 'h-36' : 'h-8'}`}
    >
      <div className="relative h-full flex flex-col">
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="absolute top-1 right-3 w-10 h-6 bg-surface hover:bg-card-active rounded-md flex items-center justify-center z-10"
          title={isVisible ? "Collapse Filmstrip" : "Expand Filmstrip"}
        >
          {isVisible ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>

        {isVisible && (
          <div className="flex-grow overflow-x-auto overflow-y-hidden p-2">
            <div className="flex h-full gap-2">
              {imageList.map((path) => {
                const isSelected = selectedImage?.path === path;
                const thumbData = thumbnails[path];
                return (
                  <div
                    key={path}
                    onClick={() => onImageSelect(path)}
                    className={`h-full aspect-square rounded-md overflow-hidden cursor-pointer flex-shrink-0 group relative transition-all duration-150 ${isSelected ? 'ring-2 ring-accent' : 'hover:ring-2 hover:ring-hover-color'}`}
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
        )}
      </div>
    </div>
  );
}