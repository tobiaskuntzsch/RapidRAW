export default function AIPanel({ selectedImage }) {
  return (
    <div className="w-80 bg-bg-secondary flex flex-col rounded-lg overflow-hidden h-full">
      <div className="p-4 flex-shrink-0">
        <h2 className="text-xl font-bold text-primary text-shadow-shiny">AI Tools</h2>
      </div>
      <div className="flex-grow overflow-y-auto p-4 text-text-secondary">
        {selectedImage ? (
          <p>AI tools for {selectedImage.path.split(/[\\/]/).pop()}</p>
        ) : (
          <p>No image selected.</p>
        )}
        {/* Placeholder for future AI features */}
      </div>
    </div>
  );
}