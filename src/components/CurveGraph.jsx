import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Dot } from 'recharts';

export default function CurveGraph({ adjustments, setAdjustments }) {
  const { curve_points } = adjustments;
  const midPointY = curve_points[1].y;

  const handleMidPointChange = (e) => {
    const newY = parseInt(e.target.value);
    setAdjustments(prev => ({
      ...prev,
      curve_points: [
        { x: 0, y: 0 },
        { x: 128, y: newY },
        { x: 255, y: 255 },
      ]
    }));
  };

  return (
    // Added consistent section padding and border
    <div className="py-4 border-b border-border-color/30">
      {/* Styled the title to be shiny */}
      <h3 className="text-lg font-bold mb-3 text-accent">Tone Curve</h3>
      
      {/* Changed background to 'surface' to make it stand out slightly */}
      <div className="w-full h-48 bg-surface p-2 rounded-md mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curve_points} margin={{ top: 5, right: 5, left: -20, bottom: -10 }}>
            {/* Updated grid line color to match theme */}
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(222, 190, 157, 0.2)" />
            <XAxis dataKey="x" type="number" domain={[0, 255]} tick={false} axisLine={false} />
            <YAxis type="number" domain={[0, 255]} tick={false} axisLine={false} />
            {/* Updated line and dot color to match theme's border/hover color */}
            <Line type="monotone" dataKey="y" stroke="#e4a875" strokeWidth={2} dot={<Dot r={4} fill="#e4a875" />} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Updated slider styling to be consistent */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-text-secondary">Midtones</label>
        <div className="flex items-center gap-4 mt-1">
          <input
            type="range"
            min="0"
            max="255"
            value={midPointY}
            onChange={handleMidPointChange}
            className="w-full h-2 bg-surface rounded-full appearance-none cursor-pointer"
          />
          <span className="text-sm text-text-primary w-12 text-center">{midPointY}</span>
        </div>
      </div>
    </div>
  );
}