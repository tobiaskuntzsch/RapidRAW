import React from 'react';

function MetadataItem({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-xs py-1.5 px-2 rounded odd:bg-bg-primary">
      <p className="font-semibold text-text-primary col-span-1 break-words">{label}</p>
      <p className="text-text-secondary col-span-2 break-words">{value}</p>
    </div>
  );
}

export default function MetadataPanel({ selectedImage }) {
  const exifEntries = selectedImage?.exif ? Object.entries(selectedImage.exif) : [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex justify-between items-center flex-shrink-0 border-b border-surface">
        <h2 className="text-xl font-bold text-primary text-shadow-shiny">Metadata</h2>
      </div>
      <div className="flex-grow overflow-y-auto p-4 text-text-secondary">
        {selectedImage ? (
          <div className="flex flex-col gap-6">
            {/* Section for File Properties */}
            <div>
              <h3 className="text-base font-bold text-text-primary mb-2 border-b border-surface pb-1">File Properties</h3>
              <div className="flex flex-col gap-1">
                <MetadataItem label="Filename" value={selectedImage.path.split(/[\\/]/).pop()} />
                <MetadataItem label="Dimensions" value={`${selectedImage.width} x ${selectedImage.height}`} />
              </div>
            </div>

            {/* Section for EXIF Data */}
            {exifEntries.length > 0 && (
              <div>
                <h3 className="text-base font-bold text-text-primary mb-2 border-b border-surface pb-1">EXIF Data</h3>
                <div className="flex flex-col gap-1">
                  {exifEntries.map(([tag, value]) => (
                    <MetadataItem key={tag} label={tag} value={value} />
                  ))}
                </div>
              </div>
            )}

            {exifEntries.length === 0 && (
               <p className="text-xs text-center text-text-secondary mt-4">No EXIF data found in this file.</p>
            )}

          </div>
        ) : (
          <p className="text-center">No image selected.</p>
        )}
      </div>
    </div>
  );
}