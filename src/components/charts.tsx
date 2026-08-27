/* Recharts wrappers with the Hambin paper-and-pine theme. */

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmtCompact } from "../lib/money";

export const CHART_COLORS = ["#0e6b5e", "#c2922e", "#275f86", "#8a5a44", "#5b7f3b", "#7a4f7c", "#a35d10", "#3d7166"];

const tipStyle = {
  background: "#fbfaf6",
  border: "1px solid #dcd8c9",
  borderRadius: 10,
  fontSize: 12,
  fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  color: "#14332e",
  boxShadow: "0 8px 24px rgba(20,40,35,.12)",
};
const tick = { fontSize: 10.5, fill: "#7b8a85", fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif" };

export function MonthBars({ data, series }: { data: { label: string }[] & Record<string, unknown>[]; series: { key: string; name: string; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} barGap={3} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 4" stroke="#e4e0d2" vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={{ stroke: "#d5d1c2" }} tickLine={false} />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtCompact(v)} width={52} />
        <Tooltip cursor={{ fill: "rgba(194,146,46,.08)" }} contentStyle={tipStyle} formatter={(v: number | string) => `PKR ${Number(v).toLocaleString()}`} />
        <Legend wrapperStyle={{ fontSize: 11.5, fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif" }} iconType="circle" iconSize={8} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={26} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ProfitArea({ data }: { data: { label: string; profit: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c2922e" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#c2922e" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 4" stroke="#e4e0d2" vertical={false} />
        <XAxis dataKey="label" tick={tick} axisLine={{ stroke: "#d5d1c2" }} tickLine={false} />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtCompact(v)} width={52} />
        <Tooltip contentStyle={tipStyle} formatter={(v: number | string) => [`PKR ${Number(v).toLocaleString()}`, "Net profit"]} />
        <Area type="monotone" dataKey="profit" stroke="#a3761f" strokeWidth={2.2} fill="url(#gp)" dot={{ r: 3, fill: "#c2922e", strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, height = 210, money = false }: { data: { name: string; value: number }[]; height?: number; money?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip contentStyle={tipStyle} formatter={(v: number | string, n: string) => [money ? `PKR ${Number(v).toLocaleString()}` : `${v} shipment${Number(v) === 1 ? "" : "s"}`, n]} />
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={3} strokeWidth={0}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif" }} iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RankBars({ data, unit = "PKR", color = "#0e6b5e" }:
  { data: { name: string; value: number; value2?: number }[]; unit?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d, i) => {
        const max = Math.max(...data.map((x) => x.value), 1);
        const max2 = Math.max(...data.map((x) => x.value2 ?? 0), 1);
        return (
          <div key={d.name}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-[12px] font-medium text-ink-700">{i + 1}. {d.name}</span>
              <span className="num whitespace-nowrap text-[11.5px] font-semibold text-ink-800">
                {unit === "PKR" ? `PKR ${fmtCompact(d.value)}` : `${d.value}`}
                {typeof d.value2 === "number" && <span className="ml-2 text-brass-600">+{fmtCompact(d.value2)}</span>}
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-paper-200">
              <div className="anim-grow-x absolute inset-y-0 left-0 rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: color, animationDelay: `${i * 70}ms` }} />
              {typeof d.value2 === "number" && (
                <div className="anim-grow-x absolute inset-y-0 left-0 rounded-full opacity-70" style={{ width: `${(d.value2 / max2) * (d.value / max) * 100}%`, background: "#c2922e", animationDelay: `${i * 70 + 120}ms` }} />
              )}
            </div>
          </div>
        );
      })}
      {data.length === 0 && <p className="py-6 text-center text-[12px] text-ink-300">No data in range</p>}
    </div>
  );
}
