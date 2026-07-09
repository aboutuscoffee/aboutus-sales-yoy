import { useState, useEffect, useCallback, useMemo } from "react";
import { getAllReports } from "../lib/db.js";
import { computeFactors, compareYoY, expectedSales } from "../lib/yoyAdjust.js";

const DAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];
const WEATHER_ICON = { sunny: "☀️", cloudy: "⛅", rainy: "🌧️", snowy: "❄️" };
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const toDateStr = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const pctFmt = (n) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`);
const ptFmt = (n) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}pt`);

function FactorBar({ label, value }) {
  if (value == null) return null;
  const isNeg = value < 0;
  const width = Math.min(Math.abs(value) * 4, 48);
  return (
    <div className="flex items-center gap-2 mb-2 text-xs">
      <span className="w-28 text-gray-500 shrink-0">{label}</span>
      <div className="relative flex-1 h-4 bg-gray-100 rounded">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300" />
        <div
          className={`absolute top-0 bottom-0 rounded ${isNeg ? "bg-red-400" : "bg-[#1e3a5f]"}`}
          style={isNeg ? { right: "50%", width: `${width}%` } : { left: "50%", width: `${width}%` }}
        />
      </div>
      <span className={`w-16 text-right font-medium shrink-0 ${isNeg ? "text-red-500" : "text-[#1e3a5f]"}`}>
        {ptFmt(value)}
      </span>
    </div>
  );
}

export default function YoyDashboard({ store }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [allReports, setAllReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllReports(store);
      setAllReports(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => { load(); }, [load]);

  const factors = useMemo(() => computeFactors(allReports), [allReports]);
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const { currentRows, lastYearRows, calendarDays } = useMemo(() => {
    const byDate = Object.fromEntries(allReports.map((r) => [r.date, r]));
    const days = daysInMonth(year, month);
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
    // 進行中の月は「今日まで」で今年・去年を揃えて比較する（月全体 vs 数日分、を防ぐ）
    const lastDayToCompare = isCurrentMonth ? today.getDate() : days;

    const cur = [];
    const cal = [];
    for (let d = 1; d <= days; d++) {
      const dateStr = toDateStr(year, month, d);
      if (dateStr > todayStr) { cal.push({ d, dateStr, isFuture: true, rep: null, delta: null }); continue; }
      const rep = byDate[dateStr];
      if (!rep || !rep.sales) { cal.push({ d, dateStr, isFuture: false, rep: null, delta: null }); continue; }
      if (d <= lastDayToCompare) cur.push(rep);
      const expected = expectedSales(dateStr, rep.weather, factors);
      const delta = expected > 0 ? (rep.sales / expected - 1) * 100 : null;
      cal.push({ d, dateStr, isFuture: false, rep, delta });
    }

    const prevYear = year - 1;
    const prev = [];
    for (let d = 1; d <= lastDayToCompare; d++) {
      const dateStr = toDateStr(prevYear, month, d);
      const rep = byDate[dateStr];
      if (rep && rep.sales) prev.push(rep);
    }

    return { currentRows: cur, lastYearRows: prev, calendarDays: cal };
  }, [allReports, year, month, todayStr, factors]);

  const yoy = useMemo(() => {
    if (!factors || !lastYearRows.length) return null;
    return compareYoY(currentRows, lastYearRows, factors);
  }, [currentRows, lastYearRows, factors]);

  const prevMonth = () => { if (month === 1) { setYear((y) => y - 1); setMonth(12); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 12) { setYear((y) => y + 1); setMonth(1); } else setMonth((m) => m + 1); };

  if (loading) return (
    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
      <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      読み込み中...
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 mb-3">
          データの読み込みに失敗しました: {error}
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100">‹</button>
        <span className="font-bold text-base">{year}年{month}月</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100">›</button>
      </div>

      {!yoy ? (
        <div className="bg-white rounded-xl border p-4 text-sm text-gray-400 text-center mb-3">
          前年同月のデータが不足しているため昨対を計算できません
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-white rounded-xl border p-3 text-center">
              <p className="text-gray-400 text-[11px] mb-1">生の昨対</p>
              <p className={`text-lg font-bold ${yoy.rawYoy >= 0 ? "text-[#1e3a5f]" : "text-red-500"}`}>{pctFmt(yoy.rawYoy)}</p>
            </div>
            <div className="bg-white rounded-xl border p-3 text-center">
              <p className="text-gray-400 text-[11px] mb-1">天気・曜日調整後昨対</p>
              <p className={`text-lg font-bold ${yoy.adjYoy >= 0 ? "text-[#1e3a5f]" : "text-red-500"}`}>{pctFmt(yoy.adjYoy)}</p>
            </div>
            <div className="bg-white rounded-xl border p-3 text-center">
              <p className="text-gray-400 text-[11px] mb-1">天候・曜日要因</p>
              <p className="text-lg font-bold text-gray-700">
                {yoy.dowContribution != null && yoy.weatherContribution != null
                  ? ptFmt(yoy.dowContribution + yoy.weatherContribution)
                  : "—"}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-3 mb-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">前年差の要因分解（曜日構成要因＋天気要因＋実力差＝生の昨対）</p>
            <FactorBar label="曜日構成要因" value={yoy.dowContribution} />
            <FactorBar label="天気要因" value={yoy.weatherContribution} />
            <FactorBar label="実力差（調整後）" value={yoy.adjYoy} />
          </div>
        </>
      )}

      <div className="bg-white rounded-xl border p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-600">日別カレンダー（平年の同曜日・同天気比）</p>
          <div className="flex gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#1e3a5f]" />好調</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400" />不調</span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {DAYS_JA.map((d) => (
            <div key={d} className="text-center text-[10px] text-gray-400 pb-1">{d}</div>
          ))}
          {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => <div key={`b${i}`} />)}
          {calendarDays.map(({ d, dateStr, isFuture, rep, delta }) => {
            const noData = isFuture || !rep || delta == null;
            let bg = "bg-gray-50", tone = "text-gray-300";
            if (!noData) {
              if (delta > 3) { bg = "bg-blue-50"; tone = "text-[#1e3a5f]"; }
              else if (delta < -3) { bg = "bg-red-50"; tone = "text-red-500"; }
              else { tone = "text-gray-500"; }
            }
            return (
              <div key={dateStr} className={`rounded-lg p-1 min-h-[52px] flex flex-col justify-between ${bg}`}>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-gray-400">{d}</span>
                  {rep?.weather && <span className="text-[10px]">{WEATHER_ICON[rep.weather]}</span>}
                </div>
                <span className={`text-[11px] font-medium ${tone}`}>
                  {noData ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
