"use client";

// م5.3 · رسوم التقارير (Recharts) بثيمة النظام الكحلية الهولوكرامية. النقر ينتقل/يُصفّي.
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AXIS = { fontSize: 11, fill: "rgba(232,237,245,0.75)" } as const;
const GRID = "rgba(148,175,209,0.12)";
const STROKE = "rgba(148,175,209,0.3)";
const TOOLTIP = {
  background: "hsl(220 36% 16%)",
  border: "1px solid rgba(148,175,209,0.4)",
  borderRadius: 12,
  fontSize: 12,
  color: "#e8edf5",
} as const;

function pick(d: unknown, key: string): string | undefined {
  const o = d as { payload?: Record<string, unknown> } & Record<string, unknown>;
  const v = o?.payload?.[key] ?? o?.[key];
  return typeof v === "string" ? v : undefined;
}

export function StatePie({ data, onSlice }: { data: { state: string; label: string; count: number; color: string }[]; onSlice?: (state: string) => void }) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={210}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="label" innerRadius={46} outerRadius={78} paddingAngle={2} onClick={(d) => { const s = pick(d, "state"); if (s) onSlice?.(s); }}>
          {data.map((d) => <Cell key={d.state} fill={d.color} stroke="rgba(11,18,32,0.5)" className="cursor-pointer outline-none" />)}
        </Pie>
        <Tooltip contentStyle={TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 11, color: "#e8edf5" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CategoryBar({ data, color = "#5775A8", onPick }: { data: { label: string; count: number }[]; color?: string; onPick?: (label: string) => void }) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={Math.min(360, Math.max(120, data.length * 30 + 24))}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 20, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={AXIS} stroke={STROKE} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={AXIS} stroke={STROKE} width={96} />
        <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "rgba(148,175,209,0.08)" }} />
        <Bar dataKey="count" fill={color} radius={[0, 5, 5, 0]} maxBarSize={22} onClick={(d) => { const l = pick(d, "label"); if (l) onPick?.(l); }} className="cursor-pointer" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function YearLine({ data }: { data: { year: string; opportunities: number; licenses: number }[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={data} margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey="year" tick={AXIS} stroke={STROKE} />
        <YAxis tick={AXIS} stroke={STROKE} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 11, color: "#e8edf5" }} />
        <Line type="monotone" dataKey="opportunities" name="فرص" stroke="#C7A24E" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="licenses" name="رخص" stroke="#5775A8" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Empty() {
  return <p className="py-8 text-center text-xs text-muted-foreground">لا بيانات ضمن التصفية.</p>;
}
