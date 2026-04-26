// Agora — Voter screens (Dashboard, Topic detail, Vote/Ranking, Profile)

function ScreenDashboard({ topics, route, setRoute, voterState, isMobile, role }) {
  const [filter, setFilter] = useState("all");
  const [openTopic, setOpenTopic] = useState(null);

  const visible = useMemo(() => {
    if (filter === "all") return topics;
    if (filter === "published") return topics.filter(t => t.status === "published");
    if (filter === "presented") return topics.filter(t => t.status === "presented");
    if (filter === "unassigned") return topics.filter(t => t.status === "unassigned");
    if (filter === "mynotes") return topics.filter(t => t.noteCount > 0).slice(0, 6);
    return topics;
  }, [topics, filter]);

  const banner = (() => {
    const myTopic = topics.find(t => t.id === ME.topicId);
    if (myTopic && myTopic.status === "presented") {
      return { tone: "amber", title: "Your turn — upload your presentation",
        sub: "Add your art and a 5-7 sentence explanation so it appears in the gallery.",
        action: <Button kind="primary" onClick={() => setRoute("upload")}>Upload now</Button> };
    }
    if (voterState === "draft") return {
      tone: "violet", title: "Voting open until 30 May, 11pm",
      sub: "You've ranked 18 of 32. Your draft saves automatically.",
      action: <Button kind="primary" onClick={() => setRoute("vote")}>Continue ranking</Button> };
    if (voterState === "submitted") return {
      tone: "neutral", title: "Ballot submitted",
      sub: "Locked at 27 May, 21:14. Results post when polls close on 30 May.",
      action: <Button kind="secondary" onClick={() => setRoute("vote")}>View ranking</Button> };
    if (voterState === "closed") return {
      tone: "amber", title: "Polls closed · Tally in progress",
      sub: "Beadle Lim is running the IRV. Results land here when ready." };
    return { tone: "violet", title: "Voting opens in 4 days",
      sub: "Take notes as presentations happen — they're private until you flip the switch.",
      action: <Button kind="secondary" onClick={() => setRoute("vote")}>Preview ballot</Button> };
  })();

  return <div style={{ padding: isMobile ? "16px 16px 24px" : "24px 32px 40px", maxWidth: 1240, margin: "0 auto" }}>
    <div className="row" style={{ marginBottom: 20, alignItems: "baseline", flexWrap: "wrap", gap: 12 }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: isMobile ? 24 : 30, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
        Class Gallery
      </h1>
      <div className="muted" style={{ fontSize: 13 }}>JDN101 · {topics.filter(t => t.status === "published").length} of {topics.length} published</div>
    </div>
    <div style={{ marginBottom: 20 }}><StatusBanner {...banner} /></div>

    <div className="row" style={{ marginBottom: 16, justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <Chips value={filter} onChange={setFilter} items={[
        { id: "all", label: "All", count: topics.length },
        { id: "published", label: "Published", count: topics.filter(t => t.status === "published").length },
        { id: "presented", label: "Presented", count: topics.filter(t => t.status === "presented").length },
        { id: "unassigned", label: "Unassigned", count: topics.filter(t => t.status === "unassigned").length },
        { id: "mynotes", label: "My notes" },
      ]} />
      <div className="row" style={{ gap: 8 }}>
        <Button kind="ghost" size="sm" icon="search">Search</Button>
      </div>
    </div>

    <div style={{
      display: "grid", gap: 16,
      gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
    }}>
      {visible.map(t => <TopicCard key={t.id} topic={t}
        isMine={t.id === ME.topicId}
        onOpen={() => { setOpenTopic(t.id); setRoute("topic"); }} />)}
    </div>
  </div>;
}

function ScreenTopicDetail({ topics, topicId, setRoute, isMobile }) {
  const t = topics.find(x => x.id === topicId) || topics[0];
  const [tab, setTab] = useState("mine");
  const [note, setNote] = useState(t.id === 5 ? "Aquinas' lex aeterna feels closer to a horizon than a code — the way ND framed the gradient was useful. Tie this to Hart's 'rule of recognition' for the paper." : "");
  const [shared, setShared] = useState(false);
  const [savedAt, setSavedAt] = useState("Saved · just now");
  const tn = useToast();

  useEffect(() => {
    if (!note) return;
    const k = setTimeout(() => setSavedAt(`Saved · ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`), 800);
    return () => clearTimeout(k);
  }, [note]);

  const Hero = () => t.status === "published"
    ? <div style={{ aspectRatio: isMobile ? "4 / 3" : "16 / 7", overflow: "hidden", borderRadius: "var(--r-lg)" }}>
        <ArtPlaceholder topic={t} />
      </div>
    : <div style={{ aspectRatio: isMobile ? "4 / 3" : "16 / 7", borderRadius: "var(--r-lg)", border: "1px solid var(--line)",
        background: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: 24 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-2)", letterSpacing: "0.1em", marginBottom: 12 }}>NÚMERO {String(t.id).padStart(2, "0")}</div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 32, fontWeight: 600, letterSpacing: "-0.015em" }}>{t.philosopher}</div>
        <div style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--text-2)", marginTop: 6 }}>{t.work}</div>
        <div style={{ marginTop: 16 }}>
          <Badge tone={t.status === "presented" ? "violet" : t.status === "assigned" ? "neutral" : "neutral"}>
            {t.status === "presented" ? "Presented · awaiting upload" :
             t.status === "assigned" ? `Upcoming · ${fmtDate(t.scheduledFor)}` : "Presenter TBA"}
          </Badge>
        </div>
      </div>;

  return <div style={{ padding: isMobile ? "16px 16px 100px" : "24px 32px 40px", maxWidth: 920, margin: "0 auto" }}>
    <div className="row" style={{ marginBottom: 16 }}>
      <Button kind="ghost" size="sm" icon="chev-l" onClick={() => setRoute("dashboard")}>Back to gallery</Button>
    </div>
    <Hero />
    <div style={{ marginTop: 20, display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div className="mono muted" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t.philosopher} · {t.work}</div>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 32, fontWeight: 600, letterSpacing: "-0.015em", margin: "4px 0 0" }}>
          {t.artTitle || t.work}
        </h1>
        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          {t.presenter ? <>by {t.presenter}{t.presentedAt && ` · presented ${fmtDate(t.presentedAt)}`}</> : "Presenter TBA"}
        </div>
      </div>
      <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
        <Button icon="note">Take notes</Button>
        <Button kind="primary" icon="vote" onClick={() => setRoute("vote")}>Add to my ranking</Button>
      </div>
    </div>

    {t.explanation && <div style={{ marginTop: 24, fontSize: 16, lineHeight: 1.7,
      fontFamily: "var(--serif)", color: "var(--text)", maxWidth: 680 }}>
      {t.explanation}
    </div>}

    <div style={{ marginTop: 32 }}>
      <Tabs value={tab} onChange={setTab} items={[
        { id: "mine", label: "My notes" },
        { id: "class", label: "Class notes", count: SAMPLE_CLASS_NOTES.length },
      ]} />
      {tab === "mine" ? <div style={{ paddingTop: 16 }}>
        <Textarea value={note} onChange={(e) => { setNote(e.target.value); setSavedAt("Saving…"); }}
          placeholder="What's catching your attention? These are private until you share them." style={{ minHeight: 120 }} />
        <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
          <div className="muted" style={{ fontSize: 12 }}>{note ? savedAt : "Notes are private until you flip the switch."}</div>
          <Switch on={shared} onChange={(v) => { setShared(v); tn.push(v ? "Note shared with class" : "Note set to private", { icon: v ? "unlock" : "lock" }); }}
            label={shared ? <span className="row" style={{ gap: 6 }}><Icon name="unlock" size={13}/> Shared with class</span>
                          : <span className="row" style={{ gap: 6 }}><Icon name="lock" size={13}/> Private</span>} />
        </div>
      </div> : <div style={{ paddingTop: 16 }} className="col">
        {SAMPLE_CLASS_NOTES.map((n, i) => <div key={i} className="card card__pad" style={{ padding: 16 }}>
          <div className="row" style={{ gap: 10, marginBottom: 8 }}>
            <Avatar name={n.author} size={26} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{n.author}</div>
              <div className="muted" style={{ fontSize: 12 }}>{n.time}</div>
            </div>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.55 }}>{n.body}</div>
        </div>)}
      </div>}
    </div>
  </div>;
}

// ─── Vote / Ranking with drag and drop ───────────────────────────────────
function ScreenVote({ topics, voterState, setRoute, isMobile }) {
  // Pre-populate a ranking for the demo
  const [ranked, setRanked] = useState(() =>
    [5, 25, 24, 16, 14, 8, 9, 19, 26, 28, 21, 23, 30, 11, 17, 15, 13, 6]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(voterState === "submitted" || voterState === "closed");
  const [search, setSearch] = useState("");
  const [draftAt, setDraftAt] = useState("Draft saved · just now");
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const tn = useToast();

  const byId = useMemo(() => Object.fromEntries(topics.map(t => [t.id, t])), [topics]);
  const unranked = topics
    .filter(t => !ranked.includes(t.id))
    .filter(t => !search || (t.philosopher + t.work + (t.artTitle || "")).toLowerCase().includes(search.toLowerCase()));

  const moveTo = (id, before) => {
    setRanked((cur) => {
      const next = cur.filter(x => x !== id);
      if (before == null) next.push(id);
      else {
        const idx = next.indexOf(before);
        next.splice(idx === -1 ? next.length : idx, 0, id);
      }
      return next;
    });
    setDraftAt("Draft saved · just now");
  };

  const onDragStart = (id) => (e) => { setDragId(id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(id)); };
  const onDragOver  = (id) => (e) => { e.preventDefault(); setOverId(id); };
  const onDrop      = (beforeId) => (e) => {
    e.preventDefault();
    const id = parseInt(e.dataTransfer.getData("text/plain")) || dragId;
    if (id) moveTo(id, beforeId);
    setDragId(null); setOverId(null);
  };

  const RankRow = ({ id, idx, ghost }) => {
    const t = byId[id];
    return <div className={`rank-row ${ghost ? "rank-row--ghost" : ""} ${dragId === id ? "rank-row--dragging" : ""}`}
      data-rank={idx + 1}
      draggable
      onDragStart={onDragStart(id)}
      onDragOver={onDragOver(id)}
      onDrop={onDrop(id)}
      onDragEnd={() => { setDragId(null); setOverId(null); }}>
      <div className="rank-handle"><Icon name="drag" size={14} /></div>
      <div className="rank-num">#{idx + 1}</div>
      <div className="rank-thumb" style={{ background: t.tint.bg, color: t.tint.ink }}>
        {t.philosopher.split(" ").slice(-1)[0][0]}
      </div>
      <div className="rank-name">
        <b>{t.philosopher}</b>
        <span>{t.artTitle || t.work}</span>
      </div>
      {idx === 0 && <Badge tone="amber">Your #1</Badge>}
      <Button kind="ghost" size="sm" onClick={() => setRanked(r => r.filter(x => x !== id))}>Remove</Button>
    </div>;
  };

  const UnrankedRow = ({ id }) => {
    const t = byId[id];
    return <div className="rank-row" draggable
      onDragStart={onDragStart(id)}
      onDragEnd={() => setDragId(null)}>
      <div className="rank-handle"><Icon name="drag" size={14} /></div>
      <div className="rank-thumb" style={{ background: t.tint.bg, color: t.tint.ink }}>
        {t.philosopher.split(" ").slice(-1)[0][0]}
      </div>
      <div className="rank-name">
        <b>{t.philosopher}</b>
        <span>{t.artTitle || t.work}</span>
      </div>
      <Button kind="ghost" size="sm" icon="plus" onClick={() => moveTo(id, null)}>Add</Button>
    </div>;
  };

  return <div style={{ padding: isMobile ? "16px 16px 120px" : "24px 32px 100px", maxWidth: 1200, margin: "0 auto" }}>
    <div className="row" style={{ marginBottom: 4, justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: isMobile ? 24 : 30, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>Your ballot</h1>
      <div className="muted" style={{ fontSize: 13 }}>{submitted ? "Locked · view-only" : draftAt}</div>
    </div>
    <p className="muted" style={{ margin: "4px 0 20px", maxWidth: 640 }}>
      Drag your favourites to the right. Order them best to worst. Anything left in the unranked column counts as no preference.
    </p>

    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
      <div className="rank-pane">
        <h3>
          <span>Unranked <span className="muted" style={{ marginLeft: 6, fontWeight: 400 }}>{unranked.length}</span></span>
        </h3>
        <div style={{ position: "relative" }}>
          <Input placeholder="Search philosopher or title…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", display: "flex" }}><Icon name="search" size={14} /></span>
        </div>
        <div style={{ marginTop: 12, maxHeight: isMobile ? 360 : 580, overflow: "auto", paddingRight: 4 }}>
          {unranked.length === 0
            ? <div className="rank-empty">Everything ranked. Reorder on the right.</div>
            : unranked.map(t => <UnrankedRow key={t.id} id={t.id} />)}
        </div>
      </div>

      <div className="rank-pane"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop(null)}>
        <h3>
          <span>My ranking <span className="muted" style={{ marginLeft: 6, fontWeight: 400 }}>{ranked.length}</span></span>
          {submitted && <Badge tone="success" icon="lock">Submitted</Badge>}
        </h3>
        {ranked.length === 0
          ? <div className="rank-empty">
              <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4, fontFamily: "var(--serif)" }}>Nº</div>
              <div style={{ fontWeight: 500, color: "var(--text)" }}>No rankings yet</div>
              <div style={{ marginTop: 4 }}>Drag a topic from the left to start your ranking.</div>
            </div>
          : <div>
              {ranked.map((id, i) => <RankRow key={id} id={id} idx={i} ghost={dragId === id && overId !== id} />)}
              <div style={{ height: 12, borderRadius: 6, background: dragId ? "var(--violet-100)" : "transparent", border: dragId ? "1px dashed var(--violet)" : "1px dashed transparent", marginTop: 4 }}
                onDragOver={(e) => e.preventDefault()} onDrop={onDrop(null)}/>
            </div>}
      </div>
    </div>

    {/* sticky bottom bar */}
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: "#fff", borderTop: "1px solid var(--line)",
      padding: "12px 24px", display: "flex", alignItems: "center", gap: 12,
      zIndex: 30,
    }}>
      <div style={{ flex: 1, fontSize: 13 }}>
        {submitted ? <span className="muted">Ballot locked · ranked {ranked.length} of 32</span>
          : voterState === "closed" ? <span className="muted">Polls open 27 May, 18:00</span>
          : <span><b>Ranked {ranked.length} of 32.</b> <span className="muted">Unranked count as no preference.</span></span>}
      </div>
      {submitted ? <Button kind="secondary" disabled icon="lock">Ballot locked</Button>
        : voterState === "closed" ? <Button kind="primary" disabled>Polls not open</Button>
        : <Button kind="primary" size="lg" onClick={() => setSubmitting(true)}>Submit final ballot</Button>}
    </div>

    <Modal open={submitting} onClose={() => setSubmitting(false)}>
      <h2>Submit your final ballot?</h2>
      <p>You ranked <b style={{ color: "var(--text)" }}>{ranked.length} of 32</b> topics. Unranked topics count as no preference.</p>
      <p style={{ background: "var(--amber-50)", color: "var(--amber)", padding: "10px 12px", borderRadius: "var(--r)" }}>
        Once submitted, your ballot is locked.
      </p>
      <div className="row" style={{ marginTop: 20, justifyContent: "flex-end", gap: 8 }}>
        <Button kind="ghost" onClick={() => setSubmitting(false)}>Cancel</Button>
        <Button kind="primary" onClick={() => { setSubmitting(false); setSubmitted(true); tn.push("Ballot submitted · locked", { icon: "check" }); }}>Submit ballot</Button>
      </div>
    </Modal>
  </div>;
}

function ScreenProfile({ topics, setRoute, role, setRole, go, isMobile }) {
  const [name, setName] = useState(ME.name);
  const myTopic = topics.find(t => t.id === ME.topicId);
  const tn = useToast();
  return <div style={{ padding: isMobile ? "16px 16px 24px" : "24px 32px 40px", maxWidth: 720, margin: "0 auto" }}>
    <h1 style={{ fontFamily: "var(--serif)", fontSize: isMobile ? 24 : 30, fontWeight: 600, margin: "0 0 24px", letterSpacing: "-0.01em" }}>Profile</h1>
    <div className="card card__pad">
      <div className="row" style={{ gap: 14, marginBottom: 24 }}>
        <Avatar name={ME.name} size={56} />
        <div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600 }}>{ME.name}</div>
          <div className="muted" style={{ fontSize: 13 }}>JDN101 · A.Y. 2025-26</div>
        </div>
      </div>
      <div className="col" style={{ gap: 16 }}>
        <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
          <Field label="School email" hint="Read-only"><Input value={ME.email} readOnly style={{ background: "var(--surface-alt)" }} /></Field>
          <Field label="Student ID" hint="Read-only"><Input value={ME.studentId} readOnly style={{ background: "var(--surface-alt)" }} /></Field>
        </div>
        <Button kind="primary" onClick={() => tn.push("Profile saved", { icon: "check" })}>Save changes</Button>
      </div>
    </div>

    {myTopic && <div className="card card__pad" style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Your assigned topic</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>You're presenting one of the 32 topics.</div>
      <div className="row" style={{ gap: 14, padding: 14, background: "var(--surface-alt)", borderRadius: "var(--r)" }}>
        <div className="rank-thumb" style={{ background: myTopic.tint.bg, color: myTopic.tint.ink, width: 44, height: 44, fontSize: 16 }}>
          {myTopic.philosopher.split(" ").slice(-1)[0][0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--serif)", fontWeight: 600 }}>{myTopic.philosopher}</div>
          <div className="muted" style={{ fontSize: 13 }}>{myTopic.work}</div>
        </div>
        {myTopic.status === "presented" && <Button kind="primary" size="sm" onClick={() => setRoute("upload")}>Upload art</Button>}
        {myTopic.status === "published" && <Badge tone="success" icon="check">Published</Badge>}
        {myTopic.status === "assigned" && <Badge tone="violet">{fmtDate(myTopic.scheduledFor)}</Badge>}
      </div>
    </div>}

    <div className="card card__pad" style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 14 }}>Session</div>
      <Button kind="ghost" onClick={() => go("landing")}>Sign out</Button>
    </div>
  </div>;
}

Object.assign(window, { ScreenDashboard, ScreenTopicDetail, ScreenVote, ScreenProfile });
