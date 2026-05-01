// Insights — calendar heatmap + simulator + auto-generated insights

const buildCalendar = (year, month) => {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

const InsightsCalendar = ({ onSelectDate }) => {
  const { t } = useT();
  const Y = 2026, M = 3;
  const cells = buildCalendar(Y, M);
  const dayMap = {};
  TX.forEach(tx => {
    const d = new Date(tx.date + "T00:00:00");
    if (d.getFullYear() === Y && d.getMonth() === M) {
      const k = d.getDate();
      if (!dayMap[k]) dayMap[k] = { in: 0, out: 0, count: 0 };
      if (tx.type === "earning") dayMap[k].in += tx.amount;
      else if (tx.type === "expense") dayMap[k].out += tx.amount;
      dayMap[k].count++;
    }
  });
  const dailyOut = Object.values(dayMap).map(d => d.out).filter(v => v > 0);
  const avgOut = dailyOut.length ? dailyOut.reduce((a,b) => a+b, 0) / dailyOut.length : 0;

  const dows = [0,1,2,3,4,5,6].map(i => t(`dow.${i}`));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div className="display" style={{ fontWeight: 700, fontSize: 18 }}>{t("ins.calMonth")}</div>
          <div className="muted" style={{ fontSize: 12 }}>{t("ins.calHint")}</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 11 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--income-soft)", border: "1px solid var(--income)" }} /> {t("ins.legend.income")}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--expense-soft)", border: "1px solid var(--expense)" }} /> {t("ins.legend.atypical")}
          </span>
        </div>
      </div>
      <div className="cal">
        {dows.map(d => <div key={d} className="cal-h">{d}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="cal-d muted-day" style={{ background: "transparent", border: "none" }} />;
          const info = dayMap[d];
          const isToday = d === 30;
          const incomeDay = info && info.in > 0 && info.in > info.out;
          const atypical = info && info.out > avgOut * 1.6 && info.out > 200_00;
          return (
            <button key={i} className={`cal-d ${isToday ? "today" : ""} ${atypical ? "atypical" : incomeDay ? "income-day" : ""}`} onClick={() => onSelectDate(`2026-04-${String(d).padStart(2, "0")}`)}>
              <div className="cal-num">{d}</div>
              {info && info.in > 0 && <div className="cal-amt money income num">{fmtMoney(info.in, { abbrev: true })}</div>}
              {info && info.out > 0 && <div className="cal-amt money expense num">−{fmtMoney(info.out, { abbrev: true })}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const computeInsights = (lang) => {
  const out = TX.filter(tx => tx.type === "expense").reduce((a, tx) => a + tx.amount, 0);
  const inc = TX.filter(tx => tx.type === "earning").reduce((a, tx) => a + tx.amount, 0);
  const inv = TX.filter(tx => tx.type === "investment").reduce((a, tx) => a + tx.amount, 0);
  const bySource = {};
  TX.filter(tx => tx.type === "expense").forEach(tx => { bySource[tx.account] = (bySource[tx.account] || 0) + tx.amount; });
  const topSrc = Object.entries(bySource).sort((a,b) => b[1] - a[1])[0];
  const topSrcAcct = ACCOUNTS.find(a => a.id === topSrc[0]);
  const subs = TX.filter(tx => tx.category === "subs").reduce((a,tx) => a+tx.amount, 0);
  const dining = TX.filter(tx => tx.category === "dining").reduce((a,tx) => a+tx.amount, 0);
  const groc = TX.filter(tx => tx.category === "groc").reduce((a,tx) => a+tx.amount, 0);
  const vrLeft = ACCOUNTS.find(a => a.id === "vr").balance;
  const aleloLeft = ACCOUNTS.find(a => a.id === "alelo").balance;
  const isPt = lang === "pt";

  if (isPt) {
    return [
      { tone: "warn", icon: "TrendingUp",
        title: `${topSrcAcct.short} concentra ${Math.round(topSrc[1]/out*100)}% dos gastos`,
        body: `${fmtMoney(topSrc[1])} este mês em ${topSrcAcct.name}. Considere migrar mercado para o VR (${fmtMoney(vrLeft)} ocioso).` },
      { tone: "info", icon: "Sparkles",
        title: dining > groc ? `Restaurantes superou Mercado em ${fmtMoney(dining-groc)}` : `Mercado supera Restaurantes em ${fmtMoney(groc-dining)}`,
        body: dining > groc ? `${fmtMoney(dining)} em restaurantes vs ${fmtMoney(groc)} no mercado. Cozinhar 2 refeições a mais por semana economiza ~${fmtMoney(8000)}.` : `Boa! ${fmtMoney(groc)} no mercado vs ${fmtMoney(dining)} em restaurantes.` },
      { tone: "good", icon: "PiggyBank",
        title: `Taxa de poupança: ${Math.round((inc - out) / inc * 100)}%`,
        body: `Renda ${fmtMoney(inc)} · Gastos ${fmtMoney(out)} · Investido ${fmtMoney(inv)}. Acima da meta de 25%.` },
      { tone: "warn", icon: "Tag",
        title: `Assinaturas: ${fmtMoney(subs)}/mês`,
        body: `Spotify, Netflix e AWS somam ${fmtMoney(subs)}/mês — ${fmtMoney(subs * 12)} ao ano.` },
      { tone: "info", icon: "Receipt",
        title: `Vouchers com saldo ocioso`,
        body: `VR ${fmtMoney(vrLeft)} · Alelo ${fmtMoney(aleloLeft)}. Esses saldos não rendem.` },
      { tone: "good", icon: "TrendingUp",
        title: `Aporte mensal: ${fmtMoney(inv)}`,
        body: `IVVB11 + Tesouro IPCA+ totalizaram ${fmtMoney(inv)}. No ritmo atual, +${fmtMoney(inv * 12)} em 12 meses.` },
    ];
  }
  return [
    { tone: "warn", icon: "TrendingUp",
      title: `${topSrcAcct.short} concentrates ${Math.round(topSrc[1]/out*100)}% of your spending`,
      body: `${fmtMoney(topSrc[1])} this month on ${topSrcAcct.name}. Consider routing groceries to your VR voucher (${fmtMoney(vrLeft)} unused).` },
    { tone: "info", icon: "Sparkles",
      title: dining > groc ? `Dining out exceeded Groceries by ${fmtMoney(dining-groc)}` : `Groceries beat Dining by ${fmtMoney(groc-dining)}`,
      body: dining > groc ? `You spent ${fmtMoney(dining)} eating out vs ${fmtMoney(groc)} on groceries. Cooking 2 more meals at home could save ~${fmtMoney(8000)}.` : `Nice — ${fmtMoney(groc)} groceries vs ${fmtMoney(dining)} dining. Keep it up.` },
    { tone: "good", icon: "PiggyBank",
      title: `Savings rate: ${Math.round((inc - out) / inc * 100)}%`,
      body: `Income ${fmtMoney(inc)} · Spending ${fmtMoney(out)} · Invested ${fmtMoney(inv)}. Above your 25% target.` },
    { tone: "warn", icon: "Tag",
      title: `Subscriptions: ${fmtMoney(subs)}/mo`,
      body: `Spotify, Netflix and AWS total ${fmtMoney(subs)}/mo — ${fmtMoney(subs * 12)} per year.` },
    { tone: "info", icon: "Receipt",
      title: `Idle voucher balances`,
      body: `VR ${fmtMoney(vrLeft)} · Alelo ${fmtMoney(aleloLeft)}. These don't earn yield — use before monthly reset.` },
    { tone: "good", icon: "TrendingUp",
      title: `Monthly contribution: ${fmtMoney(inv)}`,
      body: `IVVB11 + Treasury IPCA+ totaled ${fmtMoney(inv)}. At this pace, +${fmtMoney(inv * 12)} over 12 months.` },
  ];
};

const SimulatorCard = () => {
  const { t } = useT();
  const [salary, setSalary] = React.useState(12_400);
  const [extras, setExtras] = React.useState(3_800);
  const [fixed, setFixed] = React.useState(4_200);
  const [variable, setVariable] = React.useState(2_800);
  const [investRate, setInvestRate] = React.useState(30);
  const [months, setMonths] = React.useState(12);
  const [annualReturn, setAnnualReturn] = React.useState(11);

  const surplus = (salary + extras) - (fixed + variable);
  const toInvest = surplus * (investRate / 100);
  const toSave = surplus - toInvest;
  const monthlyReturn = annualReturn / 100 / 12;
  let fvInvested = 0;
  for (let i = 0; i < months; i++) fvInvested = (fvInvested + toInvest) * (1 + monthlyReturn);
  const fvSavings = toSave * months;
  const projectedNetWorth = 213_509 + fvInvested + fvSavings;

  const Field = ({ label, value, onChange, prefix = "R$", step = 100 }) => (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-faint)", marginBottom: 6 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}>
        <span className="muted" style={{ fontSize: 12 }}>{prefix}</span>
        <input type="number" value={value} step={step} onChange={e => onChange(Number(e.target.value))} style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--text)", fontFamily: "'Space Grotesk'", fontWeight: 600, fontSize: 16 }} className="num" />
      </div>
    </div>
  );

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">{t("ins.simTitle")}</div>
          <div className="card-sub">{t("ins.simSub")}</div>
        </div>
        <div className="seg">
          <button className={months === 6 ? "on" : ""} onClick={() => setMonths(6)}>6m</button>
          <button className={months === 12 ? "on" : ""} onClick={() => setMonths(12)}>12m</button>
          <button className={months === 24 ? "on" : ""} onClick={() => setMonths(24)}>24m</button>
          <button className={months === 60 ? "on" : ""} onClick={() => setMonths(60)}>5y</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 18 }}>
        <Field label={t("ins.field.salary")} value={salary} onChange={setSalary} />
        <Field label={t("ins.field.extras")} value={extras} onChange={setExtras} />
        <Field label={t("ins.field.fixed")} value={fixed} onChange={setFixed} />
        <Field label={t("ins.field.variable")} value={variable} onChange={setVariable} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-faint)", marginBottom: 6 }}>{t("ins.field.investRate")}</label>
          <input type="range" min="0" max="100" value={investRate} onChange={e => setInvestRate(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--brand)" }} />
          <div className="display num" style={{ fontWeight: 700, fontSize: 18, marginTop: 4 }}>{investRate}%</div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-faint)", marginBottom: 6 }}>{t("ins.field.return")}</label>
          <input type="range" min="0" max="20" value={annualReturn} onChange={e => setAnnualReturn(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--brand)" }} />
          <div className="display num" style={{ fontWeight: 700, fontSize: 18, marginTop: 4 }}>{annualReturn}{t("ins.field.returnUnit")}</div>
        </div>
      </div>

      <div style={{ background: "var(--surface-2)", borderRadius: 8, padding: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <div>
          <div className="faint" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .6, marginBottom: 4 }}>{t("ins.surplus")}</div>
          <div className="display num" style={{ fontWeight: 700, fontSize: 20, color: surplus >= 0 ? "var(--income)" : "var(--expense)" }}>{fmtMoney(surplus * 100, { sign: true })}</div>
        </div>
        <div>
          <div className="faint" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .6, marginBottom: 4 }}>{t("ins.invested")}</div>
          <div className="display num" style={{ fontWeight: 700, fontSize: 20, color: "var(--invest)" }}>{fmtMoney(toInvest * 100)}</div>
        </div>
        <div>
          <div className="faint" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .6, marginBottom: 4 }}>{t("ins.totalIn", { months })}</div>
          <div className="display num" style={{ fontWeight: 700, fontSize: 20 }}>{fmtMoney((fvInvested + fvSavings) * 100)}</div>
        </div>
        <div>
          <div className="faint" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: .6, marginBottom: 4 }}>{t("ins.projected")}</div>
          <div className="display num" style={{ fontWeight: 700, fontSize: 20, color: "var(--brand-press)" }}>{fmtMoney(projectedNetWorth * 100, { abbrev: true })}</div>
        </div>
      </div>
    </div>
  );
};

const Insights = () => {
  const { t, lang } = useT();
  const [selectedDate, setSelectedDate] = React.useState("2026-04-22");
  const dayTx = TX.filter(tx => tx.date === selectedDate);
  const insights = computeInsights(lang);
  const tones = {
    warn: { bg: "var(--expense-soft)", color: "var(--expense)" },
    good: { bg: "var(--income-soft)", color: "var(--income)" },
    info: { bg: "var(--invest-soft)", color: "var(--invest)" },
  };
  const dateLocale = lang === "pt" ? "pt-BR" : "en-US";

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("ins.title")}</h1>
          <div className="page-sub">{t("ins.sub")}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <InsightsCalendar onSelectDate={setSelectedDate} />
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("ins.dayBreakdown")}</div>
              <div className="card-sub">{new Date(selectedDate + "T00:00:00").toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long" })}</div>
            </div>
          </div>
          {dayTx.length === 0 ? (
            <div className="muted" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>{t("ins.noTx")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dayTx.map(tx => {
                const cat = CATEGORIES.find(c => c.id === tx.category);
                const acct = ACCOUNTS.find(a => a.id === tx.account);
                const cls = tx.type === "earning" ? "income" : tx.type === "expense" ? "expense" : "invest";
                return (
                  <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: cat.color + "22", color: cat.color, display: "grid", placeItems: "center", flex: "none" }}>
                      {Icons[cat.icon] && React.createElement(Icons[cat.icon], { size: 15 })}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{tx.desc}</div>
                      <div className="faint" style={{ fontSize: 11.5 }}>{cat.name} · {acct.short}</div>
                    </div>
                    <div className={`money ${cls} num display`} style={{ fontWeight: 600, fontSize: 14 }}>
                      {fmtMoney(tx.type === "expense" ? -tx.amount : tx.amount, { sign: tx.type === "earning" })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SimulatorCard />

      <div style={{ marginTop: 16 }}>
        <div className="display" style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{t("ins.detected")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {insights.map((it, i) => {
            const tone = tones[it.tone];
            const I = Icons[it.icon];
            return (
              <div key={i} className="ins">
                <div className="ins-ico" style={{ background: tone.bg, color: tone.color }}>
                  <I size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ins-title">{it.title}</div>
                  <div className="ins-body">{it.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { Insights });
