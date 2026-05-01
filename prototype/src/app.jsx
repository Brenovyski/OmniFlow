const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "sidebarCollapsed": false,
  "screen": "dashboard",
  "showFAB": true,
  "showLogin": false,
  "lang": "en"
}/*EDITMODE-END*/;

const App = () => {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const { theme, sidebarCollapsed, screen, showFAB, showLogin, lang } = tweaks;
  const [route, setRouteState] = React.useState(screen);
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [signedIn, setSignedIn] = React.useState(true);
  const [langMenuOpen, setLangMenuOpen] = React.useState(false);
  const langBtnRef = React.useRef(null);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  React.useEffect(() => {
    document.documentElement.setAttribute("lang", lang === "pt" ? "pt-BR" : "en");
  }, [lang]);

  React.useEffect(() => { setRouteState(screen); }, [screen]);

  const setRoute = (r) => {
    setRouteState(r);
    setTweak("screen", r);
  };
  const setCollapsed = (c) => setTweak("sidebarCollapsed", c);
  const setTheme = (t) => setTweak("theme", t);
  const setLang = (l) => setTweak("lang", l);

  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setCmdOpen(o => !o);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault(); setCmdOpen(true);
      } else if (e.key === "Escape") {
        setCmdOpen(false);
        setLangMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click-outside for language menu
  React.useEffect(() => {
    if (!langMenuOpen) return;
    const onClick = (e) => {
      if (langBtnRef.current && !langBtnRef.current.contains(e.target)) setLangMenuOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [langMenuOpen]);

  const fireToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  return (
    <I18nProvider lang={lang}>
      <AppShell
        tweaks={tweaks} setTweak={setTweak}
        route={route} setRoute={setRoute}
        cmdOpen={cmdOpen} setCmdOpen={setCmdOpen}
        toast={toast} fireToast={fireToast}
        signedIn={signedIn} setSignedIn={setSignedIn}
        langMenuOpen={langMenuOpen} setLangMenuOpen={setLangMenuOpen} langBtnRef={langBtnRef}
        setCollapsed={setCollapsed} setTheme={setTheme} setLang={setLang}
      />
    </I18nProvider>
  );
};

// Inner shell — needs i18n context, so it sits inside <I18nProvider>
const AppShell = ({ tweaks, setTweak, route, setRoute, cmdOpen, setCmdOpen, toast, fireToast, signedIn, setSignedIn, langMenuOpen, setLangMenuOpen, langBtnRef, setCollapsed, setTheme, setLang }) => {
  const { theme, sidebarCollapsed, showFAB, showLogin, lang } = tweaks;
  const { t } = useT();

  if (showLogin || !signedIn) {
    return <Login onSignIn={() => { setSignedIn(true); setTweak("showLogin", false); fireToast(t("toast.welcome")); }} />;
  }

  const Page = ({ route }) => {
    if (route === "dashboard") return <Dashboard openCmd={() => setCmdOpen(true)} />;
    if (route === "transactions") return <Transactions />;
    if (route === "insights") return <Insights />;
    if (route === "investments") return <Investments />;
    if (route === "categories") return <Categories />;
    if (route === "settings") return <Settings theme={theme} setTheme={setTheme} lang={lang} setLang={setLang} />;
    return null;
  };

  const titleMap = {
    dashboard: t("nav.dashboard"),
    transactions: t("nav.transactions"),
    insights: t("nav.insights"),
    investments: t("nav.investments"),
    categories: t("nav.categories"),
    settings: t("nav.settings"),
  };

  return (
    <div className={`app ${sidebarCollapsed ? "collapsed" : ""}`}>
      <Sidebar route={route} setRoute={setRoute} collapsed={sidebarCollapsed} setCollapsed={setCollapsed} openCmd={() => setCmdOpen(true)} />
      <main className="main">
        <div className="topbar">
          <button className="icon-btn" onClick={() => setCollapsed(!sidebarCollapsed)} title={t("top.toggleSidebar")}><Icons.Menu size={18} /></button>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-faint)", fontSize: 13 }}>
            <span>OmniFlow</span>
            <Icons.ChevronRight size={12} />
            <span style={{ color: "var(--text)", fontWeight: 500 }}>{titleMap[route]}</span>
          </div>
          <div className="search" onClick={() => setCmdOpen(true)} style={{ marginLeft: 24 }}>
            <Icons.Search size={14} />
            <span>{t("top.search")}</span>
            <span className="kbd">⌘K</span>
          </div>
          <div className="topbar-actions">
            <div ref={langBtnRef} style={{ position: "relative" }}>
              <button
                className="btn"
                onClick={() => setLangMenuOpen(o => !o)}
                title={t("top.language")}
                style={{ padding: "6px 10px", gap: 6, fontWeight: 600 }}
              >
                <Icons.Globe size={14} />
                <span className="mono" style={{ fontSize: 11.5, letterSpacing: ".04em" }}>{lang === "pt" ? "PT-BR" : "EN"}</span>
                <Icons.ChevronDown size={12} className="muted" />
              </button>
              {langMenuOpen && (
                <div className="menu" style={{ minWidth: 180 }}>
                  <div className="menu-item" onClick={() => { setLang("en"); setLangMenuOpen(false); }} style={{ background: lang === "en" ? "var(--surface-2)" : "transparent" }}>
                    <span style={{ fontSize: 16 }}>🇺🇸</span>
                    <span style={{ flex: 1 }}>English</span>
                    {lang === "en" && <Icons.Check size={14} style={{ color: "var(--brand-press)" }} />}
                  </div>
                  <div className="menu-item" onClick={() => { setLang("pt"); setLangMenuOpen(false); }} style={{ background: lang === "pt" ? "var(--surface-2)" : "transparent" }}>
                    <span style={{ fontSize: 16 }}>🇧🇷</span>
                    <span style={{ flex: 1 }}>Português (BR)</span>
                    {lang === "pt" && <Icons.Check size={14} style={{ color: "var(--brand-press)" }} />}
                  </div>
                </div>
              )}
            </div>
            <button className="icon-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")} title={t("top.toggleTheme")}>
              {theme === "light" ? <Icons.Moon size={16} /> : <Icons.Sun size={16} />}
            </button>
            <button className="icon-btn" title={t("top.notifications")}><Icons.Bell size={16} /></button>
            <button className="btn primary" onClick={() => setCmdOpen(true)}><Icons.Plus size={14} /> {t("top.new")}</button>
          </div>
        </div>
        <Page route={route} />
      </main>

      {showFAB && (
        <button className="fab" onClick={() => setCmdOpen(true)} title="⌘N">
          <Icons.Plus size={22} />
        </button>
      )}

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} setRoute={setRoute} />

      <TweaksPanel title="Tweaks">
        <TweakSection title="Appearance">
          <TweakRadio label="Theme" value={theme} options={[{value:"light",label:"Light"},{value:"dark",label:"Dark"}]} onChange={v => setTweak("theme", v)} />
          <TweakRadio label="Language" value={lang} options={[{value:"en",label:"English"},{value:"pt",label:"PT-BR"}]} onChange={v => setTweak("lang", v)} />
          <TweakToggle label="Sidebar collapsed" value={sidebarCollapsed} onChange={v => setTweak("sidebarCollapsed", v)} />
          <TweakToggle label="Show floating quick-add" value={showFAB} onChange={v => setTweak("showFAB", v)} />
        </TweakSection>
        <TweakSection title="Navigate">
          <TweakSelect label="Screen" value={route} options={[
            {value:"dashboard",label:"Dashboard"},
            {value:"transactions",label:"Transactions"},
            {value:"insights",label:"Insights"},
            {value:"investments",label:"Investments"},
            {value:"categories",label:"Categories"},
            {value:"settings",label:"Settings"},
          ]} onChange={v => setRoute(v)} />
          <TweakButton label="Open command palette" onClick={() => setCmdOpen(true)} />
          <TweakButton label="Preview login screen" onClick={() => setTweak("showLogin", true)} />
        </TweakSection>
      </TweaksPanel>

      <div className="toasts">
        {toast && <div className="toast"><Icons.Bolt size={14} style={{ color: "var(--brand)" }} /> {toast}</div>}
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
