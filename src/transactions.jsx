const Transactions = () => {
  const { t } = useT();
  const [filter, setFilter] = React.useState("all");
  const [acctFilter, setAcctFilter] = React.useState("all");
  let filtered = filter === "all" ? TX : TX.filter(tx => tx.type === filter);
  if (acctFilter !== "all") filtered = filtered.filter(tx => tx.account === acctFilter);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("tx.title")}</h1>
          <div className="page-sub">{t("tx.sub", { n: TX.length })}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn"><Icons.Filter size={14} /> {t("tx.filters")}</button>
          <button className="btn"><Icons.Download size={14} /> {t("tx.csv")}</button>
          <button className="btn primary"><Icons.Plus size={14} /> {t("tx.new")}</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="chip-row">
            <button className={`chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>{t("tx.all")}</button>
            <button className={`chip ${filter === "earning" ? "active" : ""}`} onClick={() => setFilter("earning")}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--income)" }} /> {t("tx.earnings")}
            </button>
            <button className={`chip ${filter === "expense" ? "active" : ""}`} onClick={() => setFilter("expense")}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--expense)" }} /> {t("tx.expenses")}
            </button>
            <button className={`chip ${filter === "investment" ? "active" : ""}`} onClick={() => setFilter("investment")}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--invest)" }} /> {t("tx.investments")}
            </button>
            <span style={{ width: 1, height: 18, background: "var(--border)", margin: "0 4px" }} />
            <button className="chip"><Icons.Calendar size={12} /> {t("tx.month")}</button>
          </div>
          <div style={{ marginLeft: "auto", color: "var(--text-faint)", fontSize: 12 }}>
            {t("tx.showing")} <strong className="muted">{filtered.length}</strong> {t("tx.of")} {TX.length}
          </div>
        </div>
        <div style={{ padding: "10px 20px 0", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
          <span className="faint" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginRight: 4 }}>{t("tx.source")}</span>
          <button className={`chip ${acctFilter === "all" ? "active" : ""}`} onClick={() => setAcctFilter("all")}>{t("tx.allSources")}</button>
          {ACCOUNTS.map(a => (
            <button key={a.id} className={`chip ${acctFilter === a.id ? "active" : ""}`} onClick={() => setAcctFilter(a.id)}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: a.color }} />
              {a.short}
            </button>
          ))}
        </div>
        <div style={{ padding: "0 20px" }}>
          <table className="tx-table">
            <thead>
              <tr>
                <th>{t("tbl.date")}</th><th>{t("tbl.description")}</th><th>{t("tbl.category")}</th><th>{t("tbl.source")}</th><th>{t("tbl.type")}</th><th className="right">{t("tbl.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => <TxRow key={tx.id} tx={tx} />)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { Transactions });
