import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

interface SparklineProps {
  values: number[];
  /** stroke color via tailwind token, e.g. "text-income" */
  tone?: "income" | "expense" | "invest" | "text";
  className?: string;
}

const TONE_STROKE: Record<NonNullable<SparklineProps["tone"]>, string> = {
  income: "hsl(var(--income))",
  expense: "hsl(var(--expense))",
  invest: "hsl(var(--invest))",
  text: "hsl(var(--text))",
};

export function Sparkline({
  values,
  tone = "text",
  className,
}: SparklineProps) {
  if (!values.length) return null;
  const data = values.map((v, i) => ({ i, v }));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.1 || 1;

  return (
    <div className={className} style={{ height: 32 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
        >
          <YAxis hide domain={[min - pad, max + pad]} />
          <Line
            type="monotone"
            dataKey="v"
            stroke={TONE_STROKE[tone]}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
