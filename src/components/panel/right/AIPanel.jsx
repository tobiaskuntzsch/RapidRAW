export default function AIPanel({ selectedImage }) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 flex justify-between items-center flex-shrink-0 border-b border-surface">
        <h2 className="text-xl font-bold text-primary text-shadow-shiny">AI Tools</h2>
      </div>
      <div className="flex-grow overflow-y-auto p-4 text-text-secondary">
        {selectedImage ? (
          <p>AI tools not yet implemented. Will appear here soon.</p>
        ) : (
          <p>No image selected.</p>
        )}
      </div>
    </div>
  );
}