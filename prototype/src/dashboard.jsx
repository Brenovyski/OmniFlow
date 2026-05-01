const KPI = ({ label, dot, value, delta, deltaDir, sparkColor, spark }) => (
  <div className="card kpi">
    <div className="kpi-label">
      <span className="kpi-dot" style={{ background: dot }} />
      {label}
    </div>
    <div className="kpi-value num">{value}</div>
    {delta && (
      <div className={`kpi-delta ${deltaDir}`}>
        {deltaDir === "up" ? <Icons.ArrowUp size={11} /> : <Icons.ArrowDown size={11} />}
        {delta}
      </div>
    )}
    <div className="kpi-spark">
      <Sparkline data={spark} color={sparkColor} height={32} />
    </div>
  </div>
);

const TypeChip = ({ type }) => {
  const { t } = useT();
  const cfg = {
    earning: { label: t("type.earning"), color: "var(--income)" },
    expense: { label: t("type.expense"), color: "var(--expense)" },
    investment: { label: t("type.investment"), color: "var(--invest)" },
  }[type];
  return (
    <span className="tx-type">
      <span className="tx-type-dot" style={{ background: cfg.color }} />
      <span className="muted">{cfg.label}</span>
    </span>
  );
};

const TxRow = ({ tx, dense }) => {
  const cat = CATEGORIES.find(c => c.id === tx.category);
  const acct = ACCOUNTS.find(a => a.id === tx.account);
  const amt = tx.type === "expense" ? -tx.amount : tx.amount;
  const cls = tx.type === "earning" ? "income" : tx.type === "expense" ? "expense" : "invest";
  return (
    <tr className="row-hover">
      <td style={{ width: 80 }} className="muted num">{fmtDate(tx.date)}</td>
      <td>
        <div style={{ fontWeight: 500 }}>{tx.desc}</div>
        {!dense && <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{acct.name}</div>}
      </td>
      <td>
        <span className="tx-cat">
          <span className="tx-cat-dot" style={{ background: cat.color }} />
          {cat.name}
        </span>
      </td>
      <td>
        <span className="src-badge" title={`${acct.name} · ${acct.type}`}>
          <span className="src-dot" style={{ background: acct.color }} />
          {acct.short}
        </span>
      </td>
      <td><TypeChip type={tx.type} /></td>
      <td className={`right money ${cls} num`} style={{ fontWeight: 600 }}>
        {fmtMoney(amt, { sign: tx.type === "earning" })}
      </td>
    </tr>
  );
};

const Dashboard = ({ openCmd }) => {
  const { t } = useT();
  const totalIn = 24_950_00;
  const totalOut = 18_420_00;
  const netSavings = totalIn - totalOut;
  const recent = TX.slice(0, 7);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("dash.greeting")}</h1>
          <div className="page-sub">{t("dash.sub")}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="seg">
            <button>7d</button>
            <button>30d</button>
            <button className="on">MTD</button>
            <button>YTD</button>
          </div>
          <button className="btn"><Icons.Download size={14} /> {t("dash.export")}</button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI label={t("dash.kpi.netWorth")} dot="var(--brand)" value={fmtMoney(123_509_00)} delta={t("dash.kpi.netWorth.delta")} deltaDir="up" sparkColor="var(--brand-press)" spark={NETWORTH.map(n => n.v)} />
        <KPI label={t("dash.kpi.income")} dot="var(--income)" value={fmtMoney(totalIn)} delta={t("dash.kpi.income.delta")} deltaDir="up" sparkColor="var(--income)" spark={CASHFLOW.map(c => c.in)} />
        <KPI label={t("dash.kpi.spending")} dot="var(--expense)" value={fmtMoney(totalOut)} delta={t("dash.kpi.spending.delta")} deltaDir="up" sparkColor="var(--expense)" spark={CASHFLOW.map(c => c.out)} />
        <KPI label={t("dash.kpi.invested")} dot="var(--invest)" value={fmtMoney(1_750_00)} delta={t("dash.kpi.invested.delta")} deltaDir="up" sparkColor="var(--invest)" spark={[400, 600, 750, 900, 1100, 1400, 1750]} />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("dash.cashflow")}</div>
              <div className="card-sub">{t("dash.cashflow.sub")}</div>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--income)" }} /> {t("dash.legend.income")}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--expense)" }} /> {t("dash.legend.spending")}
              </span>
            </div>
          </div>
          <CashflowChart data={CASHFLOW} />
          <div style={{ display: "flex", gap: 24, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <div>
              <div className="faint" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{t("dash.netSaved")}</div>
              <div className="display num" style={{ fontWeight: 700, fontSize: 22, color: "var(--income)", marginTop: 4 }}>{fmtMoney(netSavings, { sign: true })}</div>
            </div>
            <div>
              <div className="faint" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{t("dash.savingsRate")}</div>
              <div className="display num" style={{ fontWeight: 700, fontSize: 22, marginTop: 4 }}>26.2%</div>
            </div>
            <div>
              <div className="faint" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>{t("dash.avgWeek")}</div>
              <div className="display num" style={{ fontWeight: 700, fontSize: 22, marginTop: 4 }}>{fmtMoney(544_17)}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("dash.topSpend")}</div>
              <div className="card-sub">{t("dash.thisMonth")}</div>
            </div>
            <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 12 }}>{t("dash.viewAll")}</button>
          </div>
          <CategoryBars items={CATEGORY_SPEND} />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("dash.recent")}</div>
              <div className="card-sub">{t("dash.recent.sub")}</div>
            </div>
            <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 12 }}>{t("dash.seeAll")}</button>
          </div>
          <table className="tx-table">
            <thead>
              <tr>
                <th>{t("tbl.date")}</th><th>{t("tbl.description")}</th><th>{t("tbl.category")}</th><th>{t("tbl.source")}</th><th>{t("tbl.type")}</th><th className="right">{t("tbl.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(tx => <TxRow key={tx.id} tx={tx} />)}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{t("dash.accounts")}</div>
              <div className="card-sub">{t("dash.accountsSub", { n: ACCOUNTS.length })}</div>
            </div>
            <button className="btn ghost" style={{ padding: "4px 8px", fontSize: 12 }}>{t("dash.manage")}</button>
          </div>
          {ACCOUNTS.map(a => {
            const I = Icons[a.icon];
            const isNeg = a.balance < 0;
            return (
              <div className="acct-row" key={a.id}>
                <div className="acct-ico"><I size={18} /></div>
                <div style={{ minWidth: 0 }}>
                  <div className="acct-name">{a.name}</div>
                  <div className="acct-meta">{a.type} · ····{a.last4}</div>
                </div>
                <div className={`acct-bal num ${isNeg ? "money expense" : ""}`}>
                  {fmtMoney(a.balance, { sign: false })}
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
            <span className="muted" style={{ fontSize: 13 }}>{t("dash.totalLiquid")}</span>
            <span className="display num" style={{ fontWeight: 700, fontSize: 18 }}>{fmtMoney(33_896_55)}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <div className="card-title">{t("dash.netWorth12")}</div>
            <div className="card-sub">{t("dash.netWorthSub")}</div>
          </div>
          <div className="seg">
            <button>3M</button>
            <button>6M</button>
            <button className="on">1Y</button>
            <button>All</button>
          </div>
        </div>
        <NetWorthChart data={NETWORTH} />
      </div>
    </div>
  );
};

Object.assign(window, { Dashboard, TxRow, TypeChip, KPI });
