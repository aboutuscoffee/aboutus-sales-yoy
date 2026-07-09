const DOW_KEYS = [0, 1, 2, 3, 4, 5, 6];
const WEATHER_KEYS = ["sunny", "cloudy", "rainy", "snowy"];

const dowOf = (dateStr) => new Date(dateStr).getDay();

// 曜日・天気それぞれの売上への影響係数を反復比例配分法（IPF）で推定する。
// 「雨の日は曜日構成で見ても平均より◯%」という残差を交互に計算し、数回反復して収束させる。
export function computeFactors(reports) {
  const rows = reports.filter((r) => r.sales > 0);
  if (rows.length === 0) return null;

  const mu = rows.reduce((s, r) => s + r.sales, 0) / rows.length;
  const dowFactor = Object.fromEntries(DOW_KEYS.map((d) => [d, 1]));
  const weatherFactor = Object.fromEntries(WEATHER_KEYS.map((w) => [w, 1]));

  for (let iter = 0; iter < 4; iter++) {
    for (const d of DOW_KEYS) {
      const subset = rows.filter((r) => dowOf(r.date) === d);
      if (!subset.length) continue;
      const avg = subset.reduce((s, r) => s + r.sales / (weatherFactor[r.weather] || 1), 0) / subset.length;
      dowFactor[d] = avg / mu;
    }
    for (const w of WEATHER_KEYS) {
      const subset = rows.filter((r) => r.weather === w);
      if (!subset.length) continue;
      const avg = subset.reduce((s, r) => s + r.sales / (dowFactor[dowOf(r.date)] || 1), 0) / subset.length;
      weatherFactor[w] = avg / mu;
    }
  }

  return { mu, dowFactor, weatherFactor };
}

// その日の曜日・天気から「平年ならこのくらい」という期待売上を返す
export function expectedSales(dateStr, weather, factors) {
  if (!factors) return null;
  const df = factors.dowFactor[dowOf(dateStr)] ?? 1;
  const wf = weather ? factors.weatherFactor[weather] ?? 1 : 1;
  return factors.mu * df * wf;
}

function dowOnlyAdjusted(sales, dateStr, factors) {
  const df = factors.dowFactor[dowOf(dateStr)] ?? 1;
  return sales / df;
}

// 曜日・天気の効果を取り除いた「実力値」
export function fullyAdjusted(sales, dateStr, weather, factors) {
  const df = factors.dowFactor[dowOf(dateStr)] ?? 1;
  const wf = weather ? factors.weatherFactor[weather] ?? 1 : 1;
  return sales / (df * wf);
}

// 生の昨対を「曜日構成要因」「天気要因」「実力差（調整後昨対）」の3つに分解する。
// 3つを足すと生の昨対（pt）に一致する。
export function compareYoY(currentRows, lastYearRows, factors) {
  const sumRaw = (rows) => rows.reduce((s, r) => s + (r.sales || 0), 0);
  const sumDowAdj = (rows) => rows.reduce((s, r) => s + dowOnlyAdjusted(r.sales, r.date, factors), 0);
  const sumFullAdj = (rows) => rows.reduce((s, r) => s + fullyAdjusted(r.sales, r.date, r.weather, factors), 0);

  const rawCur = sumRaw(currentRows), rawPrev = sumRaw(lastYearRows);
  const dowCur = sumDowAdj(currentRows), dowPrev = sumDowAdj(lastYearRows);
  const fullCur = sumFullAdj(currentRows), fullPrev = sumFullAdj(lastYearRows);

  const pct = (cur, prev) => (prev > 0 ? (cur / prev - 1) * 100 : null);

  const rawYoy = pct(rawCur, rawPrev);
  const dowAdjYoy = pct(dowCur, dowPrev);
  const fullAdjYoy = pct(fullCur, fullPrev);

  return {
    rawYoy,
    adjYoy: fullAdjYoy,
    dowContribution: rawYoy != null && dowAdjYoy != null ? rawYoy - dowAdjYoy : null,
    weatherContribution: dowAdjYoy != null && fullAdjYoy != null ? dowAdjYoy - fullAdjYoy : null,
    rawCur, rawPrev, fullCur, fullPrev,
  };
}
