// Agora — chrome (top nav, bottom mobile nav, page shells)

function TopNav({ route, setRoute, role, isMobile }) {
  if (isMobile) return null;
  const links = [
    { id: "dashboard", label: "Dashboard", icon: "home" },
    { id: "vote",      label: "Vote",      icon: "vote" },
    { id: "profile",   label: "Profile",   icon: "user" },
  ];
  if (role === "beadle") links.push({ id: "admin", label: "Admin", icon: "shield" });
  return <div className="topnav">
    <AgoraWordmark size={18} />
    <div className="topnav__links">
      {links.map(l =>
        <div key={l.id}
          className={`topnav__link ${route.startsWith(l.id) ? "topnav__link--active" : ""}`}
          onClick={() => setRoute(l.id)}>
          {l.label}
        </div>)}
    </div>
    <div className="topnav__user">
      <span className="muted">{ME.name}</span>
      <Avatar name={ME.name} />
    </div>
  </div>;
}

function BotNav({ route, setRoute, role }) {
  const links = [
    { id: "dashboard", label: "Dashboard", icon: "home" },
    { id: "vote",      label: "Vote",      icon: "vote" },
    { id: "profile",   label: "Profile",   icon: "user" },
  ];
  if (role === "beadle") links.push({ id: "admin", label: "Admin", icon: "shield" });
  return <div className="botnav">
    {links.map(l => <div key={l.id}
      className={`botnav__item ${route.startsWith(l.id) ? "botnav__item--active" : ""}`}
      onClick={() => setRoute(l.id)}>
      <Icon name={l.icon} size={20} stroke={1.7} />
      {l.label}
    </div>)}
  </div>;
}

function PageShell({ children, route, setRoute, role, isMobile, hideNav }) {
  return <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--surface-alt)" }}>
    {!hideNav && <TopNav route={route} setRoute={setRoute} role={role} isMobile={isMobile} />}
    <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
      {children}
    </div>
    {!hideNav && isMobile && <BotNav route={route} setRoute={setRoute} role={role} />}
  </div>;
}

Object.assign(window, { TopNav, BotNav, PageShell });
