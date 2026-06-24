import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Thermometer, ChevronRight, Download, FileText, Sheet as SheetIcon, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { fetchReferenceDocuments, resolveFileUrl, type Attachment } from "@/lib/training";
import { subDays, subHours, format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer,
} from "recharts";
import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

// Wire up the bundled Roboto fonts (the import shape varies by build).
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs ?? (pdfFonts as any).vfs ?? (pdfFonts as any).default?.pdfMake?.vfs;

const GOLD = "#C89B3C";

type TempRow = {
  id: number;
  created_at: string;
  device_id: string | null;
  equipment_name: string | null;
  temperature_celsius: number | null;
  temperature_fahrenheit: number | null;
  humidity: number | null;
  battery_level: number | null;
  low_battery_alarm: boolean | null;
};

type Period = "daily" | "weekly" | "monthly";

const PERIOD_CONFIG: Record<Period, { label: string; rangeStart: () => Date; bucketFmt: string }> = {
  daily: { label: "Daily", rangeStart: () => subHours(new Date(), 24), bucketFmt: "HH:00" },
  weekly: { label: "Weekly", rangeStart: () => subDays(new Date(), 7), bucketFmt: "MMM d" },
  monthly: { label: "Monthly", rangeStart: () => subDays(new Date(), 30), bucketFmt: "MMM d" },
};

// Warm bakery palette for chart lines
const LINE_COLORS = ["#C89B3C", "#8B5E3C", "#5C7A4A", "#A33B3B", "#3C6E8B", "#7A5C8B"];

const fmt = (n: number | null, digits = 1) =>
  n === null || Number.isNaN(n) ? "—" : n.toFixed(digits);

function toDateInput(d: Date) {
  return format(d, "yyyy-MM-dd");
}

// Local timezone abbreviation (e.g. EST/EDT), DST-aware per date
function tzAbbr(d: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
    .formatToParts(d)
    .find(p => p.type === "timeZoneName")?.value ?? "";
}

// Battery level 1 (low) .. 4 (high) → color + label.
const BATTERY_META: Record<number, { color: string; label: string }> = {
  1: { color: "#A33B3B", label: "Low" },
  2: { color: "#D08A3C", label: "Fair" },
  3: { color: "#B5A93C", label: "Good" },
  4: { color: "#5C7A4A", label: "Full" },
};

// Semicircular SVG gauge for a battery level (1..4). `alarm` forces the low/red styling.
function BatteryGauge({ name, level, alarm }: { name: string; level: number | null; alarm: boolean }) {
  const clamped = level == null ? 0 : Math.max(0, Math.min(4, level));
  const meta = alarm ? BATTERY_META[1] : (BATTERY_META[clamped] ?? { color: "#999", label: "—" });
  const frac = clamped / 4; // 0..1 across the 180° arc
  const cx = 60, cy = 60, r = 48;
  const a0 = Math.PI, a1 = Math.PI * (1 - frac); // start left, sweep to right
  const pt = (a: number) => `${cx + r * Math.cos(a)},${cy - r * Math.sin(a)}`;
  const arc = (from: number, to: number) =>
    `M ${pt(from)} A ${r} ${r} 0 0 1 ${pt(to)}`;
  return (
    <div className="flex flex-col items-center text-center">
      <svg viewBox="0 0 120 78" width="120" height="78" role="img" aria-label={`${name} battery ${meta.label}`}>
        <path d={arc(Math.PI, 0)} fill="none" stroke="#E6DFCD" strokeWidth="10" strokeLinecap="round" />
        {clamped > 0 && (
          <path d={arc(a0, a1)} fill="none" stroke={meta.color} strokeWidth="10" strokeLinecap="round" />
        )}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="700" fill={meta.color}>
          {level == null ? "—" : level}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="11" fill="#666">{meta.label}</text>
      </svg>
      <div className="text-sm font-medium mt-1">{name}</div>
      {alarm && <div className="text-xs font-medium" style={{ color: BATTERY_META[1].color }}>Low-battery alarm</div>}
    </div>
  );
}

export default function TemperatureReport() {
  const [period, setPeriod] = useState<Period>("daily");
  const [start, setStart] = useState<string>(toDateInput(PERIOD_CONFIG.daily.rangeStart()));
  const [end, setEnd] = useState<string>(toDateInput(new Date()));
  const [rows, setRows] = useState<TempRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [drilldown, setDrilldown] = useState<string | null>(null);
  const [guide, setGuide] = useState<Attachment | null>(null);

  // When the period tab changes, reset the date inputs to that period's default window.
  function changePeriod(p: Period) {
    setPeriod(p);
    setStart(toDateInput(PERIOD_CONFIG[p].rangeStart()));
    setEnd(toDateInput(new Date()));
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const startTs = new Date(`${start}T00:00:00`).toISOString();
        // include the whole end day
        const endTs = new Date(`${end}T23:59:59.999`).toISOString();
        const { data, error } = await supabase
          .from("temperature_logs" as any)
          .select("id, created_at, device_id, equipment_name, temperature_celsius, temperature_fahrenheit, humidity, battery_level, low_battery_alarm")
          .gte("created_at", startTs)
          .lte("created_at", endTs)
          .order("created_at", { ascending: true })
          .limit(10000);
        if (error) throw error;
        if (!cancelled) setRows((data ?? []) as unknown as TempRow[]);
      } catch (e: any) {
        if (!cancelled) {
          toast.error("Failed to load temperature logs");
          console.error(e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [start, end]);

  // Locate the YoLink Operations Guide reference doc (by attachment filename) so we can
  // point staff to it when the report data looks missing/stale.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const docs = await fetchReferenceDocuments();
        const re = /yolink[_-]?operations[_-]?guide/i;
        for (const d of docs) {
          const atts: Attachment[] = d?.content?.attachments ?? [];
          const match = atts.find(a => re.test(a.name ?? "") || re.test(a.path ?? "") || re.test(a.url ?? ""));
          if (match) { if (!cancelled) setGuide(match); return; }
        }
      } catch {
        // Non-fatal: the hint just renders without a link.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function openGuide() {
    if (!guide) return;
    try {
      const url = guide.url ?? (guide.path ? await resolveFileUrl(guide.path) : null);
      if (url) window.open(url, "_blank", "noopener");
    } catch (e) {
      console.error(e);
      toast.error("Could not open the YoLink Operations Guide");
    }
  }

  const equipmentNames = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => set.add(r.equipment_name || r.device_id || "Unknown"));
    return Array.from(set).sort();
  }, [rows]);

  // Per-equipment summary
  const summary = useMemo(() => {
    const map = new Map<string, { count: number; min: number; max: number; sum: number; humSum: number; humCount: number }>();
    for (const r of rows) {
      const key = r.equipment_name || r.device_id || "Unknown";
      const f = r.temperature_fahrenheit;
      if (f === null) continue;
      const cur = map.get(key) ?? { count: 0, min: Infinity, max: -Infinity, sum: 0, humSum: 0, humCount: 0 };
      cur.count++;
      cur.min = Math.min(cur.min, f);
      cur.max = Math.max(cur.max, f);
      cur.sum += f;
      if (r.humidity !== null) { cur.humSum += r.humidity; cur.humCount++; }
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([name, s]) => ({
        name,
        count: s.count,
        min: s.count ? s.min : null,
        max: s.count ? s.max : null,
        avg: s.count ? s.sum / s.count : null,
        humidity: s.humCount ? s.humSum / s.humCount : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // Latest battery state per equipment (rows are ascending, so the last seen wins).
  // battery_level is 1 (low) .. 4 (high).
  const batteries = useMemo(() => {
    const map = new Map<string, { level: number | null; alarm: boolean; at: string }>();
    for (const r of rows) {
      const key = r.equipment_name || r.device_id || "Unknown";
      if (r.battery_level == null && r.low_battery_alarm == null) continue;
      map.set(key, {
        level: r.battery_level ?? null,
        alarm: !!r.low_battery_alarm,
        at: r.created_at,
      });
    }
    return Array.from(map.entries())
      .map(([name, b]) => ({ name, ...b }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const lowBatteries = useMemo(
    () => batteries.filter(b => b.alarm || (b.level != null && b.level <= 1)),
    [batteries],
  );

  // Staleness: hours since the most recent reading in range (null when no rows).
  const STALE_HOURS = 6;
  const staleHours = useMemo(() => {
    if (rows.length === 0) return null;
    const latest = rows.reduce((max, r) => Math.max(max, new Date(r.created_at).getTime()), 0);
    return (Date.now() - latest) / 3_600_000;
  }, [rows]);
  const isStale = staleHours !== null && staleHours > STALE_HOURS;

  // Chart data: bucket avg temp per equipment over time
  const chartData = useMemo(() => {
    const fmtStr = PERIOD_CONFIG[period].bucketFmt;
    // bucketKey -> { equipName -> {sum,count} }
    const buckets = new Map<string, { ts: number; perEquip: Map<string, { sum: number; count: number }> }>();
    for (const r of rows) {
      if (r.temperature_fahrenheit === null) continue;
      const d = new Date(r.created_at);
      const key = format(d, fmtStr);
      const equip = r.equipment_name || r.device_id || "Unknown";
      let b = buckets.get(key);
      if (!b) { b = { ts: d.getTime(), perEquip: new Map() }; buckets.set(key, b); }
      const pe = b.perEquip.get(equip) ?? { sum: 0, count: 0 };
      pe.sum += r.temperature_fahrenheit; pe.count++;
      b.perEquip.set(equip, pe);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[1].ts - b[1].ts)
      .map(([label, b]) => {
        const point: Record<string, number | string> = { bucket: label };
        b.perEquip.forEach((v, equip) => { point[equip] = Number((v.sum / v.count).toFixed(1)); });
        return point;
      });
  }, [rows, period]);

  // Individual readings for the drilled-down equipment, newest first
  const drilldownRows = useMemo(() => {
    if (!drilldown) return [];
    return rows
      .filter(r => (r.equipment_name || r.device_id || "Unknown") === drilldown)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [rows, drilldown]);

  const periodLabel = PERIOD_CONFIG[period].label;
  const fileStem = `temperature-${period}-${start}_to_${end}`;

  // Export raw readings in range as CSV (spreadsheet).
  function exportCsv() {
    if (rows.length === 0) { toast.error("No readings to export"); return; }
    const headers = ["Timestamp", "Timezone", "Equipment", "Device ID", "Temp °F", "Temp °C", "Humidity %", "Battery (1-4)", "Low Battery Alarm"];
    const esc = (v: string | number | null) => {
      const s = v === null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map(r => {
      const d = new Date(r.created_at);
      return [
        format(d, "yyyy-MM-dd HH:mm:ss"),
        tzAbbr(d),
        r.equipment_name ?? "",
        r.device_id ?? "",
        r.temperature_fahrenheit ?? "",
        r.temperature_celsius ?? "",
        r.humidity ?? "",
        r.battery_level ?? "",
        r.low_battery_alarm == null ? "" : (r.low_battery_alarm ? "YES" : "NO"),
      ].map(esc).join(",");
    });
    const csv = [headers.join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${fileStem}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // Export the summary report as a PDF.
  function exportPdf() {
    if (summary.length === 0) { toast.error("No data to export"); return; }
    const body = [
      ["Equipment", "Readings", "Min °F", "Max °F", "Avg °F", "Avg Humidity %"].map(t => ({ text: t, bold: true, color: "#fff" })),
      ...summary.map(s => [
        s.name, String(s.count), fmt(s.min), fmt(s.max), fmt(s.avg), fmt(s.humidity, 0),
      ]),
    ];
    const doc: TDocumentDefinitions = {
      pageMargins: [40, 50, 40, 50],
      content: [
        { text: "Temperature Monitoring Report", fontSize: 18, bold: true, color: "#2A1F0E" },
        { text: `${periodLabel} · ${start} to ${end}`, fontSize: 11, color: "#666", margin: [0, 2, 0, 2] },
        { text: `Generated ${format(new Date(), "MMM d, yyyy HH:mm")} ${tzAbbr(new Date())}`, fontSize: 9, color: "#999", margin: [0, 0, 0, 14] },
        {
          table: {
            headerRows: 1,
            widths: ["*", "auto", "auto", "auto", "auto", "auto"],
            body,
          },
          layout: {
            fillColor: (rowIndex: number) => (rowIndex === 0 ? GOLD : rowIndex % 2 === 0 ? "#F5F1E6" : null),
          },
        },
      ],
      footer: (current: number, total: number) => ({
        text: `Adventure Bakery, LLC · Confidential · ${current} of ${total}`,
        fontSize: 8, color: "#999", alignment: "center", margin: [0, 10, 0, 0],
      }),
      defaultStyle: { fontSize: 10 },
    };
    pdfMake.createPdf(doc).download(`${fileStem}.pdf`);
  }

  // Export the drilled-down equipment's individual readings as CSV.
  function exportDrilldownCsv() {
    if (drilldownRows.length === 0) { toast.error("No readings to export"); return; }
    const headers = ["Timestamp", "Timezone", "Temp °F", "Temp °C", "Humidity %"];
    const esc = (v: string | number | null) => {
      const s = v === null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = drilldownRows.map(r => {
      const d = new Date(r.created_at);
      return [
        format(d, "yyyy-MM-dd HH:mm:ss"),
        tzAbbr(d),
        r.temperature_fahrenheit ?? "",
        r.temperature_celsius ?? "",
        r.humidity ?? "",
      ].map(esc).join(",");
    });
    const csv = [headers.join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${drilldownStem()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // Export the drilled-down equipment's individual readings as PDF.
  function exportDrilldownPdf() {
    if (drilldownRows.length === 0) { toast.error("No readings to export"); return; }
    const body = [
      ["Timestamp", "Temp °F", "Temp °C", "Humidity %"].map(t => ({ text: t, bold: true, color: "#fff" })),
      ...drilldownRows.map(r => {
        const d = new Date(r.created_at);
        return [
          `${format(d, "MMM d, yyyy HH:mm")} ${tzAbbr(d)}`,
          fmt(r.temperature_fahrenheit), fmt(r.temperature_celsius), fmt(r.humidity, 0),
        ];
      }),
    ];
    const doc: TDocumentDefinitions = {
      pageMargins: [40, 50, 40, 50],
      content: [
        { text: `Temperature Readings — ${drilldown}`, fontSize: 18, bold: true, color: "#2A1F0E" },
        { text: `${periodLabel} · ${start} to ${end} · ${drilldownRows.length} readings`, fontSize: 11, color: "#666", margin: [0, 2, 0, 2] },
        { text: `Generated ${format(new Date(), "MMM d, yyyy HH:mm")} ${tzAbbr(new Date())}`, fontSize: 9, color: "#999", margin: [0, 0, 0, 14] },
        {
          table: { headerRows: 1, widths: ["*", "auto", "auto", "auto"], body },
          layout: {
            fillColor: (rowIndex: number) => (rowIndex === 0 ? GOLD : rowIndex % 2 === 0 ? "#F5F1E6" : null),
          },
        },
      ],
      footer: (current: number, total: number) => ({
        text: `Adventure Bakery, LLC · Confidential · ${current} of ${total}`,
        fontSize: 8, color: "#999", alignment: "center", margin: [0, 10, 0, 0],
      }),
      defaultStyle: { fontSize: 10 },
    };
    pdfMake.createPdf(doc).download(`${drilldownStem()}.pdf`);
  }

  function drilldownStem() {
    const slug = (drilldown ?? "equipment").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `temperature-${slug}-${start}_to_${end}`;
  }

  // Renders the guide reference as a gold text link when the doc was found, else plain text.
  function guideLink(label: string) {
    if (!guide) return <span className="font-medium">{label}</span>;
    return (
      <button type="button" onClick={openGuide} className="font-medium underline" style={{ color: GOLD }}>
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Thermometer className="h-7 w-7 mt-1" style={{ color: "#C89B3C" }} />
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "#F5F1E6" }}>Temperature Logs</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(245,241,230,0.6)" }}>
            Daily, weekly, and monthly readings from YoLink equipment sensors.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Tabs value={period} onValueChange={(v) => changePeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={rows.length === 0}>
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportPdf}>
                <FileText className="h-4 w-4 mr-2" /> PDF report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCsv}>
                <SheetIcon className="h-4 w-4 mr-2" /> Spreadsheet (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stale-data warning */}
      {isStale && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Latest reading is {Math.round(staleHours!)} hours old — sensors may have stopped
            reporting. {guideLink("See the YoLink Operations Guide")} for setup &amp; troubleshooting.
          </p>
        </div>
      )}

      {/* Low-battery warning */}
      {lowBatteries.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Low battery on {lowBatteries.map(b => b.name).join(", ")} — replace soon to avoid gaps
            in monitoring. {guideLink("See the YoLink Operations Guide")} for battery replacement.
          </p>
        </div>
      )}

      {/* Summary table */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-3">Summary by Equipment</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipment</TableHead>
              <TableHead className="text-right">Readings</TableHead>
              <TableHead className="text-right">Min °F</TableHead>
              <TableHead className="text-right">Max °F</TableHead>
              <TableHead className="text-right">Avg °F</TableHead>
              <TableHead className="text-right">Avg Humidity %</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {loading ? "Loading…" : (
                    <span>
                      No readings in this range — sensors may be offline. {guideLink("See the YoLink Operations Guide")} for setup &amp; troubleshooting.
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              summary.map((s) => (
                <TableRow
                  key={s.name}
                  className="cursor-pointer"
                  onClick={() => setDrilldown(s.name)}
                  title="View individual readings"
                >
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-right">{s.count}</TableCell>
                  <TableCell className="text-right">{fmt(s.min)}</TableCell>
                  <TableCell className="text-right">{fmt(s.max)}</TableCell>
                  <TableCell className="text-right">{fmt(s.avg)}</TableCell>
                  <TableCell className="text-right">{fmt(s.humidity, 0)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <ChevronRight className="h-4 w-4 inline" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Battery status gauges */}
      {batteries.length > 0 && (
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-1">Battery Status</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Latest reported level per sensor (1 = low · 4 = full).
          </p>
          <div className="flex flex-wrap gap-6">
            {batteries.map(b => (
              <BatteryGauge key={b.name} name={b.name} level={b.level} alarm={b.alarm} />
            ))}
          </div>
        </Card>
      )}

      {/* Chart */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-3">Average Temperature °F</h2>
        {chartData.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            {loading ? "Loading…" : "No data to chart."}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
              <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} unit="°" />
              <RTooltip />
              <Legend />
              {equipmentNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Drilldown: individual readings */}
      <Sheet open={!!drilldown} onOpenChange={(o) => !o && setDrilldown(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between gap-2 pr-8">
              <SheetTitle>{drilldown} — Readings</SheetTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={drilldownRows.length === 0}>
                    <Download className="h-4 w-4 mr-2" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportDrilldownPdf}>
                    <FileText className="h-4 w-4 mr-2" /> PDF report
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportDrilldownCsv}>
                    <SheetIcon className="h-4 w-4 mr-2" /> Spreadsheet (CSV)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetHeader>
          <p className="text-sm text-muted-foreground mt-1">
            {drilldownRows.length} readings · {start} → {end}
          </p>
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-right">°F</TableHead>
                  <TableHead className="text-right">°C</TableHead>
                  <TableHead className="text-right">Humidity %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drilldownRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No readings.
                    </TableCell>
                  </TableRow>
                ) : (
                  drilldownRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(r.created_at), "MMM d, yyyy HH:mm")} {tzAbbr(new Date(r.created_at))}
                      </TableCell>
                      <TableCell className="text-right">{fmt(r.temperature_fahrenheit)}</TableCell>
                      <TableCell className="text-right">{fmt(r.temperature_celsius)}</TableCell>
                      <TableCell className="text-right">{fmt(r.humidity, 0)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
