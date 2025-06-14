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
      className={`bg-bg-secondary border-t border-border-color/30 flex-shrink-0 transition-all duration-300 ease-in-out ${isVisible ? 'h-36' : 'h-8'}`}
    >
      <div className="relative h-full flex flex-col">
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="absolute -top-5 right-8 w-10 h-5 bg-bg-secondary hover:bg-surface rounded-t-md flex items-center justify-center border-t border-l border-r border-border-color/30"
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
                    className={`h-full aspect-square rounded-md overflow-hidden cursor-pointer flex-shrink-0 group relative transition-all duration-150 ${isSelected ? 'border-2 border-accent' : 'border-2 border-transparent hover:border-hover-color'}`}
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