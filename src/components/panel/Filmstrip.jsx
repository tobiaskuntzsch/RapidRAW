import { Image as ImageIcon } from 'lucide-react';

export default function Filmstrip({ 
  imageList, 
  selectedImage, 
  onImageSelect, 
  thumbnails
}) {
  return (
    <div className="h-full overflow-x-auto overflow-y-hidden p-1">
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
  );
}