// Agora — Prototype shell. Routes between screens, owns voter state.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "role": "voter",
  "voterState": "draft",
  "device": "desktop",
  "showDevicePicker": true
}/*EDITMODE-END*/;

function Prototype() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState("dashboard");
  const [topicId, setTopicIdState] = useState(5); // default open Aquinas
  const setRouteWithTopic = (r, tid) => { if (tid) setTopicIdState(tid); setRoute(r); };
  const topics = useMemo(() => buildTopics(), []);

  const role = tweaks.role;            // voter | presenter | beadle
  const voterState = tweaks.voterState; // pre | draft | submitted | closed
  const device = tweaks.device;         // desktop | mobile
  const isMobile = device === "mobile";

  // role: presenter starts on dashboard with the upload banner (ME is presenter for Plato)
  // beadle should default to admin if landing
  useEffect(() => {
    if (role === "beadle" && !route.startsWith("admin")) setRoute("admin");
    if (role !== "beadle" && route.startsWith("admin")) setRoute("dashboard");
  }, [role]);

  const go = (r) => setRoute(r);

  // Public routes are independent of auth state. We expose them as separate "screens" via tweak.
  const isPublic = ["landing", "register", "signin", "await-email", "await-approval", "rejected"].includes(route);

  const screen = (() => {
    switch (route) {
      case "landing":         return <ScreenLanding go={go} />;
      case "register":        return <ScreenRegister go={go} />;
      case "signin":          return <ScreenSignin go={go} />;
      case "await-email":     return <ScreenAwaitEmail go={go} />;
      case "await-approval":  return <ScreenAwaitApproval go={go} />;
      case "rejected":        return <ScreenRejected go={go} />;
      case "dashboard":       return <ScreenDashboard topics={topics} route={route} setRoute={setRouteWithTopic} voterState={voterState} role={role} isMobile={isMobile} />;
      case "topic":           return <ScreenTopicDetail topics={topics} topicId={topicId} setRoute={setRoute} isMobile={isMobile} />;
      case "vote":            return <ScreenVote topics={topics} voterState={voterState} setRoute={setRoute} isMobile={isMobile} />;
      case "profile":         return <ScreenProfile topics={topics} setRoute={setRoute} role={role} go={go} isMobile={isMobile} />;
      case "upload":          return <ScreenUpload topics={topics} setRoute={setRoute} isMobile={isMobile} />;
      case "admin":           return <ScreenAdminHome topics={topics} setRoute={setRoute} isMobile={isMobile} />;
      case "admin-approvals": return <ScreenAdminApprovals topics={topics} isMobile={isMobile} />;
      case "admin-voters":    return <ScreenAdminVoters topics={topics} isMobile={isMobile} />;
      case "admin-topics":    return <ScreenAdminTopics topics={topics} isMobile={isMobile} />;
      case "admin-voting":    return <ScreenAdminVoting isMobile={isMobile} />;
      case "admin-results":   return <ScreenResults topics={topics} isMobile={isMobile} />;
      default:                return <ScreenDashboard topics={topics} route={route} setRoute={setRouteWithTopic} voterState={voterState} role={role} isMobile={isMobile} />;
    }
  })();

  // Admin sub-routes deserve a sub-nav in the page, not a route guard.
  const adminSub = route.startsWith("admin") && route !== "admin" ? null : null;

  return <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
    <PageShell route={route} setRoute={setRoute} role={role} isMobile={isMobile} hideNav={isPublic}>
      {role === "beadle" && route.startsWith("admin") && <AdminSubNav route={route} setRoute={setRoute} isMobile={isMobile} />}
      {screen}
    </PageShell>

    <PrototypeTweaks tweaks={tweaks} setTweak={setTweak} route={route} setRoute={setRoute} />
  </div>;
}

function AdminSubNav({ route, setRoute, isMobile }) {
  const items = [
    { id: "admin", label: "Overview" },
    { id: "admin-approvals", label: "Approvals" },
    { id: "admin-voters", label: "Voters" },
    { id: "admin-topics", label: "Topics" },
    { id: "admin-voting", label: "Voting" },
    { id: "admin-results", label: "Results" },
  ];
  return <div style={{ background: "#fff", borderBottom: "1px solid var(--line)", padding: isMobile ? "0 8px" : "0 24px", overflowX: "auto" }}>
    <div style={{ display: "flex", gap: 2 }}>
      {items.map(it => <div key={it.id}
        onClick={() => setRoute(it.id)}
        style={{ padding: "12px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
          color: route === it.id ? "var(--violet-600)" : "var(--text-2)",
          borderBottom: `2px solid ${route === it.id ? "var(--violet)" : "transparent"}`,
          marginBottom: -1,
        }}>{it.label}</div>)}
    </div>
  </div>;
}

function PrototypeTweaks({ tweaks, setTweak, route, setRoute }) {
  const allRoutes = [
    { group: "Public", items: [
      ["landing", "Landing"], ["register", "Register"], ["signin", "Sign in"],
      ["await-email", "Await email"], ["await-approval", "Await approval"], ["rejected", "Rejected"],
    ]},
    { group: "Voter", items: [
      ["dashboard", "Dashboard"], ["topic", "Topic detail"], ["vote", "Vote"], ["profile", "Profile"], ["upload", "Upload (presenter)"],
    ]},
    { group: "Admin", items: [
      ["admin", "Admin home"], ["admin-approvals", "Approvals"], ["admin-voters", "Voters"],
      ["admin-topics", "Topics"], ["admin-voting", "Voting"], ["admin-results", "Results"],
    ]},
  ];
  return <TweaksPanel title="Tweaks">
    <TweakSection title="Role">
      <TweakRadio label="Viewing as" value={tweaks.role} onChange={(v) => setTweak("role", v)}
        options={[{ value: "voter", label: "Voter" }, { value: "presenter", label: "Presenter" }, { value: "beadle", label: "Beadle" }]} />
    </TweakSection>
    <TweakSection title="Voting state">
      <TweakRadio label="Ballot status" value={tweaks.voterState} onChange={(v) => setTweak("voterState", v)}
        options={[{ value: "pre", label: "Pre-open" }, { value: "draft", label: "Drafting" }, { value: "submitted", label: "Submitted" }, { value: "closed", label: "Closed" }]} />
    </TweakSection>
    <TweakSection title="Device">
      <TweakRadio label="Layout" value={tweaks.device} onChange={(v) => setTweak("device", v)}
        options={[{ value: "desktop", label: "Desktop" }, { value: "mobile", label: "Mobile" }]} />
    </TweakSection>
    <TweakSection title="Jump to screen">
      <div style={{ maxHeight: 240, overflow: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {allRoutes.map(g => <div key={g.group}>
          <div style={{ fontSize: 11, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 0" }}>{g.group}</div>
          {g.items.map(([id, label]) => <div key={id}
            onClick={() => setRoute(id)}
            style={{ padding: "6px 10px", borderRadius: 4, cursor: "pointer", fontSize: 13,
              background: route === id ? "var(--violet-100)" : "transparent",
              color: route === id ? "var(--violet-600)" : "var(--text)" }}>{label}</div>)}
        </div>)}
      </div>
    </TweakSection>
  </TweaksPanel>;
}

Object.assign(window, { Prototype });
