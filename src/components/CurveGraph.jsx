import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Dot } from 'recharts';
import Slider from './ui/Slider';

export default function CurveGraph({ adjustments, setAdjustments }) {
  const { curve_points } = adjustments;
  // Ensure we have a valid midpoint, defaulting to 128 if not present
  const midPointY = curve_points?.[1]?.y ?? 128;

  const handleMidPointChange = (e) => {
    // The value from the slider is a string, so we parse it
    const newY = parseInt(e.target.value, 10);
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
    <div>
      <div className="w-full h-48 bg-surface p-2 rounded-md mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curve_points} margin={{ top: 5, right: 5, left: -20, bottom: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(222, 190, 157, 0.2)" />
            <XAxis dataKey="x" type="number" domain={[0, 255]} tick={false} axisLine={false} />
            <YAxis type="number" domain={[0, 255]} tick={false} axisLine={false} />
            <Line type="monotone" dataKey="y" stroke="#e4a875" strokeWidth={2} dot={<Dot r={4} fill="#e4a875" />} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <Slider
        label="Midtones"
        value={midPointY}
        onChange={handleMidPointChange}
        min="0"
        max="255"
        step="1"
        defaultValue={128}
      />
    </div>
  );
}