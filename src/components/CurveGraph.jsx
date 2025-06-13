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
    <div className="section">
      <h3 className="section-title">Tone Curve</h3>
      <div className="w-full h-48 bg-bg-primary p-2 rounded-md mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curve_points} margin={{ top: 5, right: 5, left: -20, bottom: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ "rgba(161, 161, 166, 0.3)" } />
            <XAxis dataKey="x" type="number" domain={[0, 255]} tick={false} axisLine={false} />
            <YAxis type="number" domain={[0, 255]} tick={false} axisLine={false} />
            <Line type="monotone" dataKey="y" stroke="#0a84ff" strokeWidth={2} dot={<Dot r={4} fill="#0a84ff" />} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="slider-container">
        <label className="label">Midtones</label>
        <div className="slider-wrapper">
          <input
            type="range"
            min="0"
            max="255"
            value={midPointY}
            onChange={handleMidPointChange}
            className="slider-track"
          />
          <span className="slider-value">{midPointY}</span>
        </div>
      </div>
    </div>
  );
}