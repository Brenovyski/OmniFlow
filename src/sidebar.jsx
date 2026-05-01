const NAV = [
  { id: "dashboard", labelKey: "nav.dashboard", icon: "Dashboard" },
  { id: "transactions", labelKey: "nav.transactions", icon: "Transactions", badge: "18" },
  { id: "insights", labelKey: "nav.insights", icon: "Sparkles" },
  { id: "investments", labelKey: "nav.investments", icon: "Investments" },
  { id: "categories", labelKey: "nav.categories", icon: "Categories" },
];
const NAV2 = [
  { id: "settings", labelKey: "nav.settings", icon: "Settings" },
];

const Sidebar = ({ route, setRoute, collapsed, setCollapsed, openCmd }) => {
  const { t } = useT();
  const renderItem = (item) => {
    const I = Icons[item.icon];
    const active = route === item.id;
    const label = t(item.labelKey);
    return (
      <button key={item.id} className={`nav-item ${active ? "active" : ""}`} onClick={() => setRoute(item.id)} title={collapsed ? label : undefined}>
        <I className="nav-ico" size={18} />
        <span className="nav-label">{label}</span>
        {item.badge && <span className="nav-badge">{item.badge}</span>}
      </button>
    );
  };
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand-mark">
          <img src="assets/volt.svg" alt="Volt" />
        </div>
        <div className="brand-text">
          <div className="brand-name">OmniFlow</div>
          <div className="brand-sub">{t("brand.tagline")}</div>
        </div>
      </div>

      <div className="nav">
        <button className="nav-item" onClick={openCmd} style={{ marginBottom: 8 }}>
          <Icons.Plus className="nav-ico" />
          <span className="nav-label" style={{ fontWeight: 600, color: "var(--text)" }}>{t("nav.quickAdd")}</span>
          <span className="nav-badge mono">⌘N</span>
        </button>
        <div className="nav-section">{t("nav.section.workspace")}</div>
        {NAV.map(renderItem)}
        <div className="nav-section">{t("nav.section.account")}</div>
        {NAV2.map(renderItem)}
      </div>

      <div className="sidebar-foot">
        <button className="nav-item" onClick={() => setCollapsed(!collapsed)} title={t("nav.collapse")}>
          {collapsed ? <Icons.ChevronRight className="nav-ico" /> : <Icons.ChevronLeft className="nav-ico" />}
          <span className="nav-label collapse-label">{t("nav.collapse")}</span>
        </button>
        <div className="user-card">
          <div className="avatar">JM</div>
          <div className="user-text" style={{ minWidth: 0, flex: 1 }}>
            <div className="user-name">Jordan Mills</div>
            <div className="user-meta">jordan@omniflow.app</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

Object.assign(window, { Sidebar });
