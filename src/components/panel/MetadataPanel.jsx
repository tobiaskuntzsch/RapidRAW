export default function MetadataPanel({ selectedImage }) {
  return (
    <div className="w-80 bg-bg-secondary flex flex-col rounded-lg overflow-hidden h-full">
      <div className="p-4 flex-shrink-0">
        <h2 className="text-xl font-bold text-primary text-shadow-shiny">Metadata</h2>
      </div>
      <div className="flex-grow overflow-y-auto p-4 text-text-secondary">
        {selectedImage ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-bold text-text-primary text-sm">Filename</p>
              <p className="text-xs break-words">{selectedImage.path.split(/[\\/]/).pop()}</p>
            </div>
            <div>
              <p className="font-bold text-text-primary text-sm">Dimensions</p>
              <p className="text-xs">{selectedImage.width} x {selectedImage.height}</p>
            </div>
            {/* You can display more metadata here in the future */}
          </div>
        ) : (
          <p>No image selected.</p>
        )}
      </div>
    </div>
  );
}