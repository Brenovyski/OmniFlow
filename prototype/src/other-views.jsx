// Investments / Categories / Settings / Empty / Login / Command palette
const Investments = () => {
  const { t } = useT();
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("inv.title")}</h1>
          <div className="page-sub">{t("inv.sub")}</div>
        </div>
        <button className="btn primary"><Icons.Plus size={14} /> {t("inv.logBuy")}</button>
      </div>
      <div className="kpi-grid">
        <KPI label={t("inv.kpi.value")} dot="var(--invest)" value={fmtMoney(92_410_00)} delta={t("inv.todaysGain")} deltaDir="up" sparkColor="var(--invest)" spark={[88, 89, 87, 90, 91, 92, 92.4]} />
        <KPI label={t("inv.kpi.gain")} dot="var(--income)" value={fmtMoney(18_240_00, { sign: true })} delta={t("inv.gainAllTime")} deltaDir="up" sparkColor="var(--income)" spark={[10, 12, 13, 15, 17, 18, 18.2]} />
        <KPI label={t("inv.kpi.basis")} dot="var(--text-muted)" value={fmtMoney(74_170_00)} sparkColor="var(--text-muted)" spark={[70, 71, 72, 73, 74, 74, 74.1]} />
        <KPI label={t("inv.kpi.mtd")} dot="var(--brand-press)" value={fmtMoney(1_750_00)} delta={t("inv.buys24")} deltaDir="up" sparkColor="var(--brand-press)" spark={[0, 0, 750, 750, 1750, 1750, 1750]} />
      </div>
      <div className="card">
        <div className="card-head">
          <div className="card-title">{t("inv.holdings")}</div>
          <div className="card-sub">{t("inv.positions", { n: 5 })}</div>
        </div>
        <table className="tx-table">
          <thead><tr><th>{t("inv.ticker")}</th><th>{t("inv.name")}</th><th className="right">{t("inv.shares")}</th><th className="right">{t("inv.avgCost")}</th><th className="right">{t("inv.value")}</th><th className="right">{t("inv.gain")}</th></tr></thead>
          <tbody>
            {[
              ["VTSAX","Vanguard Total Market","148.42","218.60","41_290_00","+18.4%"],
              ["VTIAX","Vanguard Intl Stock","82.00","32.10","3_140_00","+9.2%"],
              ["AAPL","Apple Inc.","56","142.10","12_180_00","+38.6%"],
              ["ARKK","ARK Innovation","118","48.20","6_410_00","-7.4%"],
              ["BTC","Bitcoin","0.42","41200.00","29_390_00","+62.1%"],
            ].map(([tk,n,s,c,v,g],i) => (
              <tr key={i} className="row-hover">
                <td style={{ fontWeight: 600, fontFamily: "'JetBrains Mono'" }}>{tk}</td>
                <td>{n}</td>
                <td className="right num muted">{s}</td>
                <td className="right num muted">R${c}</td>
                <td className="right num display" style={{ fontWeight: 600 }}>{fmtMoney(parseInt(v.replace(/_/g,"")))}</td>
                <td className={`right num`} style={{ color: g.startsWith("-") ? "var(--expense)" : "var(--income)", fontWeight: 600 }}>{g}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Categories = () => {
  const { t } = useT();
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("cat.title")}</h1>
          <div className="page-sub">{t("cat.sub")}</div>
        </div>
        <button className="btn primary"><Icons.Plus size={14} /> {t("cat.new")}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {CATEGORIES.map(c => {
          const I = Icons[c.icon];
          const count = TX.filter(tx => tx.category === c.id).length;
          return (
            <div key={c.id} className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: c.color + "22", color: c.color, display: "grid", placeItems: "center", flex: "none" }}>
                <I size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>
                <div className="faint" style={{ fontSize: 11.5 }}>{t("cat.txCount", { n: count })}</div>
              </div>
              <Icons.MoreH className="muted" size={16} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Settings = ({ theme, setTheme, lang, setLang }) => {
  const { t } = useT();
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("set.title")}</h1>
          <div className="page-sub">{t("set.sub")}</div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-title" style={{ marginBottom: 14 }}>{t("set.appearance")}</div>
        <div style={{ display: "flex", gap: 12 }}>
          {["light","dark"].map(th => (
            <button key={th} onClick={() => setTheme(th)} className="btn" style={{ flex: 1, justifyContent: "center", padding: 14, background: theme === th ? "var(--surface-2)" : "var(--surface)", borderColor: theme === th ? "var(--brand)" : "var(--border)" }}>
              {th === "light" ? <Icons.Sun size={16} /> : <Icons.Moon size={16} />}
              <span>{t(`set.theme.${th}`)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-title" style={{ marginBottom: 4 }}>{t("set.language")}</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{t("set.languageSub")}</div>
        <div style={{ display: "flex", gap: 12 }}>
          {[{id:"en",flag:"🇺🇸",name:"English"},{id:"pt",flag:"🇧🇷",name:"Português (BR)"}].map(l => (
            <button key={l.id} onClick={() => setLang(l.id)} className="btn" style={{ flex: 1, justifyContent: "center", padding: 14, background: lang === l.id ? "var(--surface-2)" : "var(--surface)", borderColor: lang === l.id ? "var(--brand)" : "var(--border)" }}>
              <span style={{ fontSize: 18 }}>{l.flag}</span>
              <span>{l.name}</span>
              {lang === l.id && <Icons.Check size={14} style={{ color: "var(--brand-press)", marginLeft: "auto" }} />}
            </button>
          ))}
        </div>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-title" style={{ marginBottom: 4 }}>{t("set.currency")}</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{t("set.currencySub")}</div>
        <select className="btn" style={{ width: "100%", padding: 10 }}>
          <option>BRL — Real Brasileiro</option><option>USD — US Dollar</option><option>EUR — Euro</option>
        </select>
      </div>
      <div className="card">
        <div className="card-title" style={{ marginBottom: 14 }}>{t("set.data")}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn"><Icons.Download size={14} /> {t("set.exportAll")}</button>
          <button className="btn"><Icons.Folder size={14} /> {t("set.import")}</button>
        </div>
      </div>
    </div>
  );
};

const EmptyVolt = ({ title, sub, cta }) => (
  <div className="empty">
    <img src="assets/volt.svg" alt="" className="empty-volt" />
    <h3 className="empty-title">{title}</h3>
    <div className="empty-sub">{sub}</div>
    <button className="btn primary"><Icons.Plus size={14} /> {cta}</button>
  </div>
);

const CommandPalette = ({ open, onClose, setRoute }) => {
  const { t } = useT();
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState(0);
  const items = [
    { type: "action", icon: "Plus",       labelKey: "cmd.new.tx", hint: "⌘N" },
    { type: "action", icon: "Receipt",    labelKey: "cmd.new.earn", hint: "" },
    { type: "action", icon: "TrendingUp", labelKey: "cmd.new.invest", hint: "" },
    { type: "nav", icon: "Dashboard",    labelKey: "cmd.go.dashboard",    route: "dashboard",    hint: "G D" },
    { type: "nav", icon: "Transactions", labelKey: "cmd.go.transactions", route: "transactions", hint: "G T" },
    { type: "nav", icon: "Sparkles",     labelKey: "cmd.go.insights",     route: "insights",     hint: "G N" },
    { type: "nav", icon: "Investments",  labelKey: "cmd.go.investments",  route: "investments",  hint: "G I" },
    { type: "nav", icon: "Categories",   labelKey: "cmd.go.categories",   route: "categories",   hint: "G C" },
    { type: "nav", icon: "Settings",     labelKey: "cmd.go.settings",     route: "settings",     hint: "G S" },
  ].map(it => ({ ...it, label: t(it.labelKey) }));
  const filtered = items.filter(i => i.label.toLowerCase().includes(q.toLowerCase()));
  React.useEffect(() => { if (open) setQ(""); setSel(0); }, [open]);
  React.useEffect(() => { setSel(0); }, [q]);
  if (!open) return null;
  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(filtered.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === "Enter") {
      const it = filtered[sel];
      if (it?.route) setRoute(it.route);
      onClose();
    }
  };
  return (
    <div className="scrim" onClick={onClose}>
      <div className="palette" onClick={e => e.stopPropagation()}>
        <input autoFocus className="palette-input" placeholder={t("cmd.placeholder")} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} />
        <div className="palette-list">
          {filtered.length === 0 ? (
            <div className="muted" style={{ padding: 24, textAlign: "center", fontSize: 13 }}>{t("cmd.noMatches")}</div>
          ) : (
            <>
              {filtered.some(i => i.type === "action") && <div className="palette-section">{t("cmd.actions")}</div>}
              {filtered.filter(i => i.type === "action").map((it, i) => {
                const idx = filtered.indexOf(it);
                const I = Icons[it.icon];
                return (
                  <div key={`a${i}`} className={`palette-item ${idx === sel ? "sel" : ""}`} onMouseEnter={() => setSel(idx)} onClick={() => onClose()}>
                    <I className="pi-ico" /><span style={{ flex: 1 }}>{it.label}</span><span className="kbd">{it.hint}</span>
                  </div>
                );
              })}
              {filtered.some(i => i.type === "nav") && <div className="palette-section">{t("cmd.navigate")}</div>}
              {filtered.filter(i => i.type === "nav").map((it, i) => {
                const idx = filtered.indexOf(it);
                const I = Icons[it.icon];
                return (
                  <div key={`n${i}`} className={`palette-item ${idx === sel ? "sel" : ""}`} onMouseEnter={() => setSel(idx)} onClick={() => { setRoute(it.route); onClose(); }}>
                    <I className="pi-ico" /><span style={{ flex: 1 }}>{it.label}</span><span className="kbd">{it.hint}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
        <div className="palette-foot">
          <span className="kbd">↑↓</span> {t("cmd.foot.nav")} <span className="kbd">↵</span> {t("cmd.foot.select")} <span className="kbd">esc</span> {t("cmd.foot.close")}
          <span style={{ marginLeft: "auto" }}>⚡ OmniFlow</span>
        </div>
      </div>
    </div>
  );
};

const Login = ({ onSignIn }) => {
  const { t } = useT();
  const [showPw, setShowPw] = React.useState(false);
  return (
    <div className="login-bg">
      <div className="login-card">
        <img src="assets/volt.svg" className="login-volt" alt="Volt" />
        <h1 className="display" style={{ fontSize: 28, fontWeight: 700, textAlign: "center", margin: 0, letterSpacing: "-0.02em" }}>{t("login.welcome")}</h1>
        <div className="muted" style={{ textAlign: "center", marginTop: 6, marginBottom: 24, fontSize: 14 }}>{t("login.sub")}</div>
        <form onSubmit={e => { e.preventDefault(); onSignIn(); }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>{t("login.email")}</label>
          <input className="btn" defaultValue="jordan@omniflow.app" style={{ width: "100%", padding: 10, marginBottom: 14 }} />
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>{t("login.password")}</label>
          <div style={{ position: "relative", marginBottom: 18 }}>
            <input className="btn" type={showPw ? "text" : "password"} defaultValue="••••••••••" style={{ width: "100%", padding: 10, paddingRight: 38 }} />
            <button type="button" onClick={() => setShowPw(s => !s)} className="icon-btn" style={{ position: "absolute", right: 4, top: 4 }}>
              {showPw ? <Icons.EyeOff size={15} /> : <Icons.Eye size={15} />}
            </button>
          </div>
          <button type="submit" className="btn primary" style={{ width: "100%", justifyContent: "center", padding: 11 }}>{t("login.signIn")}</button>
        </form>
        <div className="muted" style={{ fontSize: 11, textAlign: "center", marginTop: 22 }}>{t("login.tagline")}</div>
      </div>
    </div>
  );
};

Object.assign(window, { Investments, Categories, Settings, EmptyVolt, CommandPalette, Login });
