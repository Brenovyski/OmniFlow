// SVG charts — no library
const CashflowChart = ({ data, height = 240 }) => {
  const W = 720, H = height, pad = { l: 40, r: 16, t: 16, b: 28 };
  const max = Math.max(...data.map(d => Math.max(d.in, d.out))) * 1.15;
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const bw = innerW / data.length;
  const bar = 11;
  const yTicks = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: "block" }}>
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = pad.t + (innerH * i) / yTicks;
        const v = max - (max * i) / yTicks;
        return (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} className="grid-line" />
            <text x={pad.l - 8} y={y + 3} textAnchor="end" className="axis-label">R${(v / 1000).toFixed(1)}k</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = pad.l + bw * i + bw / 2;
        const inH = (d.in / max) * innerH;
        const outH = (d.out / max) * innerH;
        return (
          <g key={i}>
            <rect x={x - bar - 1} y={pad.t + innerH - inH} width={bar} height={inH} rx="2" fill="var(--income)" />
            <rect x={x + 1} y={pad.t + innerH - outH} width={bar} height={outH} rx="2" fill="var(--expense)" opacity="0.85" />
            {i % 2 === 0 && <text x={x} y={H - 8} textAnchor="middle" className="axis-label">{d.w}</text>}
          </g>
        );
      })}
    </svg>
  );
};

const Sparkline = ({ data, color = "var(--income)", height = 36 }) => {
  const W = 120, H = height;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return [x, y];
  });
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const fillD = `${d} L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`spk-${color.replace(/[^a-z]/gi, "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#spk-${color.replace(/[^a-z]/gi, "")})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const NetWorthChart = ({ data, height = 220 }) => {
  const W = 720, H = height, pad = { l: 44, r: 12, t: 16, b: 26 };
  const max = Math.max(...data.map(d => d.v)) * 1.05;
  const min = Math.min(...data.map(d => d.v)) * 0.95;
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const xAt = i => pad.l + (i / (data.length - 1)) * innerW;
  const yAt = v => pad.t + innerH - ((v - min) / (max - min)) * innerH;
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(d.v)}`).join(" ");
  const fill = `${path} L${xAt(data.length - 1)},${pad.t + innerH} L${pad.l},${pad.t + innerH} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="nw-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.30" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map(i => {
        const y = pad.t + (innerH * i) / 3;
        const v = max - ((max - min) * i) / 3;
        return (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} className="grid-line" />
            <text x={pad.l - 8} y={y + 3} textAnchor="end" className="axis-label">R${(v / 1000).toFixed(0)}k</text>
          </g>
        );
      })}
      <path d={fill} fill="url(#nw-grad)" />
      <path d={path} fill="none" stroke="var(--brand-press)" strokeWidth="2" />
      {data.map((d, i) => i % 2 === 0 && (
        <text key={i} x={xAt(i)} y={H - 8} textAnchor="middle" className="axis-label">{d.m}</text>
      ))}
      {data.map((d, i) => i === data.length - 1 && (
        <g key={`pt-${i}`}>
          <circle cx={xAt(i)} cy={yAt(d.v)} r="4" fill="var(--brand)" stroke="var(--surface)" strokeWidth="2" />
        </g>
      ))}
    </svg>
  );
};

const CategoryBars = ({ items }) => {
  const max = Math.max(...items.map(i => i.amount));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map(it => {
        const cat = CATEGORIES.find(c => c.id === it.cat);
        const pct = (it.amount / max) * 100;
        return (
          <div key={it.cat}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: cat.color }} />
                <span style={{ fontWeight: 500 }}>{cat.name}</span>
              </span>
              <span className="num muted">{fmtMoney(it.amount)}</span>
            </div>
            <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: cat.color, borderRadius: 3 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

Object.assign(window, { CashflowChart, Sparkline, NetWorthChart, CategoryBars });
