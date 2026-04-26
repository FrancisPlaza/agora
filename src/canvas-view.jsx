// Agora — Design canvas: all 18 screens + component sheet, side by side.

function ABFrame({ children, w = 1200, h = 800 }) {
  return <div style={{ width: w, height: h, overflow: "hidden", background: "var(--surface-alt)", position: "relative" }}>
    <div style={{ width: w, height: h, overflow: "hidden" }}>{children}</div>
  </div>;
}

// Render a screen instance with isolated state
function ScreenWrap({ children, scroll = false, h = 800 }) {
  return <div style={{ width: "100%", height: h, overflow: scroll ? "auto" : "hidden", background: "var(--surface-alt)" }}>{children}</div>;
}

function CanvasView() {
  const topics = useMemo(() => buildTopics(), []);
  const desktop = { width: 1280, height: 820 };
  const mobile = { width: 390, height: 820 };

  // Inline screens, each in their own ABFrame
  const dummyGo = (r) => {};
  const dummySet = (r) => {};

  return <DesignCanvas>
    {/* Public ─────────────────────────────────────────── */}
    <DCSection id="public" title="Public · pre-auth" subtitle="Landing, registration, sign-in, holding states">
      <DCArtboard id="01-landing" label="01 · Landing" width={desktop.width} height={desktop.height}>
        <ABFrame {...desktop}><ScreenLanding go={dummyGo} /></ABFrame>
      </DCArtboard>
      <DCArtboard id="02-register" label="02 · Register" width={desktop.width} height={desktop.height}>
        <ABFrame {...desktop}><ScreenRegister go={dummyGo} /></ABFrame>
      </DCArtboard>
      <DCArtboard id="03-signin" label="03 · Sign in" width={desktop.width} height={desktop.height}>
        <ABFrame {...desktop}><ScreenSignin go={dummyGo} /></ABFrame>
      </DCArtboard>
      <DCArtboard id="04-await-email" label="04 · Confirm email" width={desktop.width} height={desktop.height}>
        <ABFrame {...desktop}><ScreenAwaitEmail go={dummyGo} /></ABFrame>
      </DCArtboard>
      <DCArtboard id="05-await-approval" label="05 · Pending approval" width={desktop.width} height={desktop.height}>
        <ABFrame {...desktop}><ScreenAwaitApproval go={dummyGo} /></ABFrame>
      </DCArtboard>
      <DCArtboard id="06-rejected" label="06 · Rejected" width={desktop.width} height={desktop.height}>
        <ABFrame {...desktop}><ScreenRejected go={dummyGo} /></ABFrame>
      </DCArtboard>
    </DCSection>

    {/* Voter desktop ──────────────────────────────────── */}
    <DCSection id="voter-desktop" title="Voter · desktop" subtitle="The cornerstone screens. Drafting state.">
      <DCArtboard id="07-dashboard" label="07 · Dashboard (drafting)" width={1280} height={1100}>
        <ABFrame width={1280} height={1100}>
          <PageShell route="dashboard" setRoute={dummySet} role="voter" isMobile={false}>
            <ScreenDashboard topics={topics} route="dashboard" setRoute={dummySet} voterState="draft" role="voter" isMobile={false} />
          </PageShell>
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="08-topic" label="08 · Topic detail" width={1280} height={1100}>
        <ABFrame width={1280} height={1100}>
          <PageShell route="topic" setRoute={dummySet} role="voter" isMobile={false}>
            <ScreenTopicDetail topics={topics} topicId={5} setRoute={dummySet} isMobile={false} />
          </PageShell>
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="09-vote" label="09 · Ranking" width={1280} height={1100}>
        <ABFrame width={1280} height={1100}>
          <PageShell route="vote" setRoute={dummySet} role="voter" isMobile={false}>
            <ScreenVote topics={topics} voterState="draft" setRoute={dummySet} isMobile={false} />
          </PageShell>
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="11-profile" label="11 · Profile" width={1280} height={900}>
        <ABFrame width={1280} height={900}>
          <PageShell route="profile" setRoute={dummySet} role="voter" isMobile={false}>
            <ScreenProfile topics={topics} setRoute={dummySet} role="voter" go={dummyGo} isMobile={false} />
          </PageShell>
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="12-upload" label="12 · Presenter upload" width={1280} height={1100}>
        <ABFrame width={1280} height={1100}>
          <PageShell route="upload" setRoute={dummySet} role="presenter" isMobile={false}>
            <ScreenUpload topics={topics} setRoute={dummySet} isMobile={false} />
          </PageShell>
        </ABFrame>
      </DCArtboard>
    </DCSection>

    {/* Voter mobile ────────────────────────────────────── */}
    <DCSection id="voter-mobile" title="Voter · mobile" subtitle="iPhone-sized variants of the cornerstone screens.">
      <DCArtboard id="07m-dashboard" label="07m · Dashboard" width={mobile.width} height={mobile.height}>
        <ABFrame {...mobile}>
          <PageShell route="dashboard" setRoute={dummySet} role="voter" isMobile={true}>
            <ScreenDashboard topics={topics} route="dashboard" setRoute={dummySet} voterState="draft" role="voter" isMobile={true} />
          </PageShell>
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="08m-topic" label="08m · Topic" width={mobile.width} height={mobile.height}>
        <ABFrame {...mobile}>
          <PageShell route="topic" setRoute={dummySet} role="voter" isMobile={true}>
            <ScreenTopicDetail topics={topics} topicId={5} setRoute={dummySet} isMobile={true} />
          </PageShell>
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="09m-vote" label="09m · Ranking" width={mobile.width} height={mobile.height}>
        <ABFrame {...mobile}>
          <PageShell route="vote" setRoute={dummySet} role="voter" isMobile={true}>
            <ScreenVote topics={topics} voterState="draft" setRoute={dummySet} isMobile={true} />
          </PageShell>
        </ABFrame>
      </DCArtboard>
    </DCSection>

    {/* Admin ──────────────────────────────────────────── */}
    <DCSection id="admin-desktop" title="Beadle · admin" subtitle="Approvals, voters, topics, voting controls, results.">
      <DCArtboard id="13-admin-home" label="13 · Admin home" width={1280} height={1100}>
        <ABFrame width={1280} height={1100}>
          <PageShell route="admin" setRoute={dummySet} role="beadle" isMobile={false}>
            <AdminSubNav route="admin" setRoute={dummySet} isMobile={false} />
            <ScreenAdminHome topics={topics} setRoute={dummySet} isMobile={false} />
          </PageShell>
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="14-approvals" label="14 · Approvals" width={1280} height={900}>
        <ABFrame width={1280} height={900}>
          <PageShell route="admin-approvals" setRoute={dummySet} role="beadle" isMobile={false}>
            <AdminSubNav route="admin-approvals" setRoute={dummySet} isMobile={false} />
            <ScreenAdminApprovals topics={topics} isMobile={false} />
          </PageShell>
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="15-voters" label="15 · Voters" width={1280} height={1100}>
        <ABFrame width={1280} height={1100}>
          <PageShell route="admin-voters" setRoute={dummySet} role="beadle" isMobile={false}>
            <AdminSubNav route="admin-voters" setRoute={dummySet} isMobile={false} />
            <ScreenAdminVoters topics={topics} isMobile={false} />
          </PageShell>
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="16-topics" label="16 · Topics admin" width={1280} height={1100}>
        <ABFrame width={1280} height={1100}>
          <PageShell route="admin-topics" setRoute={dummySet} role="beadle" isMobile={false}>
            <AdminSubNav route="admin-topics" setRoute={dummySet} isMobile={false} />
            <ScreenAdminTopics topics={topics} isMobile={false} />
          </PageShell>
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="17-voting" label="17 · Voting controls" width={1280} height={900}>
        <ABFrame width={1280} height={900}>
          <PageShell route="admin-voting" setRoute={dummySet} role="beadle" isMobile={false}>
            <AdminSubNav route="admin-voting" setRoute={dummySet} isMobile={false} />
            <ScreenAdminVoting isMobile={false} />
          </PageShell>
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="18-results" label="18 · Results" width={1280} height={1500}>
        <ABFrame width={1280} height={1500}>
          <PageShell route="admin-results" setRoute={dummySet} role="beadle" isMobile={false}>
            <AdminSubNav route="admin-results" setRoute={dummySet} isMobile={false} />
            <ScreenResults topics={topics} isMobile={false} />
          </PageShell>
        </ABFrame>
      </DCArtboard>
    </DCSection>

    {/* Component sheet ───────────────────────────────── */}
    <DCSection id="components" title="Component sheet" subtitle="Atoms and molecules used across the system.">
      <DCArtboard id="ds-buttons" label="Buttons & switches" width={760} height={520}>
        <ABFrame width={760} height={520}>
          <ComponentSheetButtons />
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="ds-fields" label="Form fields" width={760} height={620}>
        <ABFrame width={760} height={620}>
          <ComponentSheetFields topics={topics} />
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="ds-cards" label="Topic cards · 4 states" width={1100} height={520}>
        <ABFrame width={1100} height={520}>
          <ComponentSheetCards topics={topics} />
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="ds-misc" label="Badges, banners, notes" width={900} height={680}>
        <ABFrame width={900} height={680}>
          <ComponentSheetMisc />
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="ds-rank" label="Ranking row + drag" width={760} height={460}>
        <ABFrame width={760} height={460}>
          <ComponentSheetRank topics={topics} />
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="ds-modals" label="Modals & toasts" width={900} height={620}>
        <ABFrame width={900} height={620}>
          <ComponentSheetModals />
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="ds-empty" label="Empty & loading states" width={900} height={520}>
        <ABFrame width={900} height={520}>
          <ComponentSheetEmpty />
        </ABFrame>
      </DCArtboard>
      <DCArtboard id="ds-tokens" label="Tokens · type & colour" width={900} height={620}>
        <ABFrame width={900} height={620}>
          <ComponentSheetTokens />
        </ABFrame>
      </DCArtboard>
    </DCSection>
  </DesignCanvas>;
}

// ─── Component sheet pieces ──────────────────────────────────────────────
function Sheet({ title, children, cols = 1 }) {
  return <div style={{ padding: 28, height: "100%", overflow: "auto" }}>
    <h3 style={{ fontFamily: "var(--serif)", fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>{title}</h3>
    <div style={{ display: "grid", gap: 20, gridTemplateColumns: `repeat(${cols}, 1fr)` }}>{children}</div>
  </div>;
}
function Row({ label, children }) {
  return <div>
    <div className="muted" style={{ fontSize: 11, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{label}</div>
    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>{children}</div>
  </div>;
}

function ComponentSheetButtons() {
  const [on, setOn] = useState(false);
  return <Sheet title="Buttons & switches">
    <Row label="Primary"><Button kind="primary">Primary</Button><Button kind="primary" size="lg">Primary large</Button><Button kind="primary" disabled>Disabled</Button></Row>
    <Row label="Secondary"><Button>Secondary</Button><Button icon="plus">With icon</Button><Button disabled>Disabled</Button></Row>
    <Row label="Ghost"><Button kind="ghost">Ghost</Button><Button kind="ghost" icon="chev-l">Back</Button></Row>
    <Row label="Destructive"><Button kind="danger">Danger outline</Button><Button kind="solid-danger">Lock ballots</Button></Row>
    <Row label="Switch (animated)">
      <Switch on={on} onChange={setOn} label={on ? "Shared with class" : "Private"} />
    </Row>
  </Sheet>;
}
function ComponentSheetFields() {
  return <Sheet title="Form fields" cols={2}>
    <Field label="Text"><Input placeholder="School email"/></Field>
    <Field label="Text · focus"><Input placeholder="Tab here" autoFocus/></Field>
    <Field label="Select"><Select><option>Choose a topic…</option></Select></Field>
    <Field label="Date / time"><Input type="datetime-local" defaultValue="2026-05-30T23:00"/></Field>
    <Field label="Textarea" hint="Notes are private until you flip the switch."><Textarea placeholder="Your notes…" rows={3}/></Field>
    <Field label="Error" error="Email must end in @sanbeda.edu.ph"><Input value="andrea@gmail.com" readOnly /></Field>
    <Field label="File upload" hint="JPG, PNG, WEBP, HEIC, PDF · 10 MB">
      <div style={{ border: "2px dashed var(--line)", background: "var(--surface-alt)", borderRadius: 8, padding: 20, textAlign: "center", fontSize: 13 }}>
        <Icon name="upload" size={18} /><div style={{ marginTop: 6 }}>Drop a file or browse</div>
      </div>
    </Field>
  </Sheet>;
}
function ComponentSheetCards({ topics }) {
  const sample = [
    { ...topics[29], status: "unassigned", presenter: null, artTitle: null, explanation: null },
    { ...topics[24], status: "assigned" },
    { ...topics[19], status: "presented" },
    { ...topics[0], status: "published" },
  ];
  return <div style={{ padding: 28 }}>
    <h3 style={{ fontFamily: "var(--serif)", fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>Topic card · 4 states</h3>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
      {sample.map((t, i) => <div key={i}>
        <TopicCard topic={t} isMine={i === 3} onOpen={() => {}} />
        <div className="muted" style={{ fontSize: 11, marginTop: 8, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.status}{i === 3 ? " · yours" : ""}</div>
      </div>)}
    </div>
  </div>;
}
function ComponentSheetMisc() {
  return <Sheet title="Badges, banners, notes">
    <Row label="Badges">
      <Badge tone="neutral">Neutral</Badge>
      <Badge tone="violet">Violet</Badge>
      <Badge tone="amber">Yours</Badge>
      <Badge tone="success" icon="check">Approved</Badge>
      <Badge tone="danger">Rejected</Badge>
      <Badge tone="navy" icon="shield">Beadle</Badge>
    </Row>
    <Row label="Banners">
      <div style={{ width: "100%" }}><StatusBanner tone="violet" title="Voting open until 30 May, 11pm" sub="You've ranked 18 of 32." action={<Button kind="primary">Continue</Button>}/></div>
    </Row>
    <div><StatusBanner tone="amber" title="Your turn — upload your presentation" sub="Add your art and explanation." action={<Button kind="primary">Upload</Button>}/></div>
    <Row label="Note · own">
      <div className="card card__pad" style={{ padding: 14, width: "100%" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <div className="muted" style={{ fontSize: 12 }}>Saved · 2s ago</div>
          <Switch on={false} onChange={() => {}} label={<span className="row" style={{ gap: 6 }}><Icon name="lock" size={13}/> Private</span>}/>
        </div>
        <div style={{ fontSize: 14 }}>Tie this to Hart's rule of recognition for the paper.</div>
      </div>
    </Row>
    <Row label="Note · shared">
      <div className="card card__pad" style={{ padding: 14, width: "100%" }}>
        <div className="row" style={{ gap: 10, marginBottom: 8 }}>
          <Avatar name="Bea Villanueva" size={26} />
          <div><div style={{ fontWeight: 500, fontSize: 13 }}>Bea Villanueva</div>
            <div className="muted" style={{ fontSize: 12 }}>2h ago</div></div>
        </div>
        <div style={{ fontSize: 14 }}>The way she framed the cave as institutional — not just epistemic — is the part I'll remember.</div>
      </div>
    </Row>
  </Sheet>;
}
function ComponentSheetRank({ topics }) {
  return <Sheet title="Ranking row">
    {[5, 25, 24].map((id, i) => {
      const t = topics.find(x => x.id === id);
      return <div key={id} className="rank-row" data-rank={i + 1}>
        <div className="rank-handle"><Icon name="drag" size={14} /></div>
        <div className="rank-num">#{i + 1}</div>
        <div className="rank-thumb" style={{ background: t.tint.bg, color: t.tint.ink }}>
          {t.philosopher.split(" ").slice(-1)[0][0]}
        </div>
        <div className="rank-name"><b>{t.philosopher}</b><span>{t.artTitle || t.work}</span></div>
        {i === 0 && <Badge tone="amber">Your #1</Badge>}
      </div>;
    })}
    <div className="rank-row rank-row--dragging">
      <div className="rank-handle"><Icon name="drag" size={14} /></div>
      <div className="rank-num">#4</div>
      <div className="rank-thumb" style={{ background: "#E1ECEF", color: "#1F3A42" }}>M</div>
      <div className="rank-name"><b>John Stuart Mill</b><span>Harm Principle</span></div>
      <Badge tone="violet">Dragging</Badge>
    </div>
  </Sheet>;
}
function ComponentSheetModals() {
  return <div style={{ padding: 28, height: "100%" }}>
    <h3 style={{ fontFamily: "var(--serif)", fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>Modals & toasts</h3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div className="modal" style={{ position: "relative", animation: "none", padding: 24, boxShadow: "var(--shadow-2)" }}>
        <h2>Submit your final ballot?</h2>
        <p>You ranked <b>23 of 32</b> topics. Unranked count as no preference.</p>
        <p style={{ background: "var(--amber-50)", color: "var(--amber)", padding: "10px 12px", borderRadius: 6 }}>Once submitted, your ballot is locked.</p>
        <div className="row" style={{ marginTop: 16, justifyContent: "flex-end", gap: 8 }}>
          <Button kind="ghost">Cancel</Button><Button kind="primary">Submit ballot</Button>
        </div>
      </div>
      <div>
        <div className="toast" style={{ animation: "none", marginBottom: 8 }}><Icon name="check" size={14}/> Ballot submitted · locked</div>
        <div className="toast" style={{ animation: "none", marginBottom: 8 }}><Icon name="unlock" size={14}/> Note shared with class</div>
        <div className="toast" style={{ animation: "none" }}><Icon name="lock" size={14}/> Note set to private</div>
      </div>
    </div>
  </div>;
}
function ComponentSheetEmpty() {
  return <Sheet title="Empty & loading states" cols={2}>
    <div className="rank-empty">
      <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4, fontFamily: "var(--serif)" }}>Nº</div>
      <div style={{ fontWeight: 500, color: "var(--text)" }}>No rankings yet</div>
      <div style={{ marginTop: 4 }}>Drag a topic from the left to start your ranking.</div>
    </div>
    <div className="rank-empty">
      <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4, fontFamily: "var(--serif)" }}>—</div>
      <div style={{ fontWeight: 500, color: "var(--text)" }}>No notes here yet</div>
      <div style={{ marginTop: 4 }}>Notes you take during this presentation will appear here.</div>
    </div>
    <div className="card card__pad" style={{ padding: 16 }}>
      <Skeleton h={20} w="60%"/><div style={{ height: 8 }}/>
      <Skeleton h={140}/><div style={{ height: 12 }}/>
      <Skeleton h={14}/><div style={{ height: 6 }}/>
      <Skeleton h={14} w="70%"/>
    </div>
    <div className="card card__pad" style={{ padding: 16 }}>
      <div className="row" style={{ gap: 10 }}><div className="skel" style={{ width: 26, height: 26, borderRadius: 999 }}/>
        <div style={{ flex: 1 }}><Skeleton h={12} w="40%"/><div style={{ height: 6 }}/><Skeleton h={10} w="25%"/></div></div>
      <div style={{ height: 12 }}/>
      <Skeleton h={14}/><div style={{ height: 6 }}/><Skeleton h={14} w="80%"/>
    </div>
  </Sheet>;
}
function ComponentSheetTokens() {
  const swatches = [
    ["Navy", "#0A2540"], ["Violet", "#635BFF"], ["Amber", "#B8860B"],
    ["Surface", "#FFFFFF", true], ["Surface alt", "#F6F9FC", true],
    ["Text", "#1A1F36"], ["Text-2", "#64748B"], ["Line", "#E3E8EE", true],
  ];
  return <div style={{ padding: 28 }}>
    <h3 style={{ fontFamily: "var(--serif)", fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>Type & colour tokens</h3>
    <div style={{ marginBottom: 24 }}>
      <div className="muted" style={{ fontSize: 11, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Source Serif · for headings & topic titles</div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 36, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.1 }}>Right reason. The eternal order. The veil.</div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontStyle: "italic", color: "var(--text-2)", marginTop: 4 }}>Italic for art titles and quoted phrases</div>
    </div>
    <div style={{ marginBottom: 24 }}>
      <div className="muted" style={{ fontSize: 11, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Inter · UI & body</div>
      <div style={{ fontSize: 14, lineHeight: 1.5 }}>Drag your favourites to the right. Order them best to worst. Anything left in the unranked column counts as no preference.</div>
    </div>
    <div className="muted" style={{ fontSize: 11, fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Palette</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
      {swatches.map(([name, hex, light]) => <div key={name} style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }}>
        <div style={{ background: hex, height: 56, borderBottom: light ? "1px solid var(--line)" : "none" }}/>
        <div style={{ padding: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
          <div className="mono muted" style={{ fontSize: 11 }}>{hex}</div>
        </div>
      </div>)}
    </div>
  </div>;
}

Object.assign(window, { CanvasView });
