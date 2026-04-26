// Agora — Admin (beadle) screens

function AdminShell({ children, title, sub, isMobile }) {
  return <div style={{ padding: isMobile ? "16px 16px 24px" : "24px 32px 40px", maxWidth: 1240, margin: "0 auto" }}>
    <div className="row" style={{ gap: 8, marginBottom: 6 }}>
      <Badge tone="navy" icon="shield">Beadle</Badge>
    </div>
    <h1 style={{ fontFamily: "var(--serif)", fontSize: isMobile ? 24 : 30, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>{title}</h1>
    {sub && <div className="muted" style={{ marginTop: 6 }}>{sub}</div>}
    <div style={{ marginTop: 24 }}>{children}</div>
  </div>;
}

function ScreenAdminHome({ topics, setRoute, isMobile }) {
  const pending = PENDING_VOTERS.length;
  const notPresented = topics.filter(t => t.status !== "presented" && t.status !== "published").length;
  const submitted = 14, total = 32;
  return <AdminShell isMobile={isMobile} title="Admin overview" sub="Approvals, presentations, ballots — all in one place.">
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
      {[
        { id: "approvals", title: "Pending approvals", value: pending, foot: "Awaiting beadle review", route: "admin-approvals", tone: "amber" },
        { id: "topics", title: "Topics not yet presented", value: notPresented, foot: "Out of 32 topics", route: "admin-topics", tone: "violet" },
        { id: "ballots", title: "Ballots submitted", value: `${submitted} of ${total}`, foot: "Polls open · 30 May 23:00", route: "admin-voting", tone: "navy" },
      ].map(c => <div key={c.id} className="card card__pad" style={{ cursor: "pointer" }} onClick={() => setRoute(c.route)}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.title}</div>
          <Icon name="arrow-r" size={14} />
        </div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 38, fontWeight: 600, lineHeight: 1.1, margin: "8px 0 4px", letterSpacing: "-0.02em" }}>{c.value}</div>
        <div className="muted" style={{ fontSize: 13 }}>{c.foot}</div>
      </div>)}
    </div>

    <div className="card" style={{ marginTop: 24 }}>
      <div className="card__pad" style={{ borderBottom: "1px solid var(--line-2)" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600 }}>Audit log</div>
            <div className="muted" style={{ fontSize: 13 }}>Recent admin actions across the class.</div>
          </div>
          <Button kind="ghost" size="sm">Export</Button>
        </div>
      </div>
      <div>
        {SAMPLE_AUDIT.map((a, i) => <div key={i} className="row" style={{ padding: "14px 20px", borderBottom: i < SAMPLE_AUDIT.length - 1 ? "1px solid var(--line-2)" : "none", gap: 14 }}>
          <Avatar name={a.actor} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14 }}>
              <b>{a.actor}</b> <span className="muted">{a.action}</span> <b>{a.target}</b>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>{a.at}</div>
          </div>
        </div>)}
      </div>
    </div>
  </AdminShell>;
}

function ScreenAdminApprovals({ topics, isMobile }) {
  const [items, setItems] = useState(PENDING_VOTERS.map((v, i) => ({ ...v, topicId: i === 0 ? 31 : null })));
  const tn = useToast();
  const availableTopics = topics.filter(t => t.status === "unassigned" || items.every(it => it.topicId !== t.id));
  return <AdminShell isMobile={isMobile} title="Approval queue" sub="Assign each voter to one of the remaining topics, then approve.">
    <div className="card" style={{ overflow: "hidden" }}>
      <table className="tbl">
        <thead><tr>
          <th>Voter</th><th>Student ID</th><th>Registered</th><th>Assign topic</th><th style={{ textAlign: "right" }}>Actions</th>
        </tr></thead>
        <tbody>
          {items.map((v, i) => <tr key={i}>
            <td>
              <div className="row" style={{ gap: 10 }}>
                <Avatar name={v.name} size={28} />
                <div>
                  <div style={{ fontWeight: 500 }}>{v.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{v.email}</div>
                </div>
              </div>
            </td>
            <td className="mono">{v.studentId}</td>
            <td className="muted">{v.at}</td>
            <td style={{ minWidth: 220 }}>
              <Select value={v.topicId || ""} onChange={(e) => {
                const id = parseInt(e.target.value) || null;
                setItems(xs => xs.map((x, j) => j === i ? { ...x, topicId: id } : x));
              }}>
                <option value="">Select a topic…</option>
                {topics.map(t => <option key={t.id} value={t.id}
                  disabled={t.status !== "unassigned" && items.find(it => it.topicId === t.id && it !== v)}>
                  Nº {String(t.id).padStart(2, "0")} · {t.philosopher}
                  {t.status !== "unassigned" ? " (taken)" : ""}
                </option>)}
              </Select>
            </td>
            <td>
              <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                <Button kind="danger" size="sm" onClick={() => { setItems(xs => xs.filter((_, j) => j !== i)); tn.push(`Rejected ${v.name}`); }}>Reject</Button>
                <Button kind="primary" size="sm" disabled={!v.topicId} onClick={() => { setItems(xs => xs.filter((_, j) => j !== i)); tn.push(`Approved ${v.name}`, { icon: "check" }); }}>Approve</Button>
              </div>
            </td>
          </tr>)}
          {items.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--text-2)" }}>
            <div className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Nothing in the queue</div>
            <div>You're all caught up. New registrations will land here.</div>
          </td></tr>}
        </tbody>
      </table>
    </div>
  </AdminShell>;
}

function ScreenAdminVoters({ topics, isMobile }) {
  const [filter, setFilter] = useState("all");
  const sample = useMemo(() => STUDENTS.slice(0, 24).map((name, i) => {
    const status = i < 22 ? "approved" : i === 22 ? "pending" : "rejected";
    const ballot = i < 14 ? "submitted" : i < 20 ? "draft" : i < 22 ? "not-started" : "—";
    return { name, email: name.toLowerCase().replace(/\s+/g, ".") + "@sanbeda.edu.ph",
      status, ballot, topic: topics[i % 32] };
  }), [topics]);
  const visible = sample.filter(v => filter === "all" || v.status === filter);
  return <AdminShell isMobile={isMobile} title="Voters" sub="Everyone the class roster has touched.">
    <div className="row" style={{ marginBottom: 12, gap: 12, justifyContent: "space-between" }}>
      <Chips value={filter} onChange={setFilter} items={[
        { id: "all", label: "All", count: sample.length },
        { id: "approved", label: "Approved" },
        { id: "pending", label: "Pending" },
        { id: "rejected", label: "Rejected" },
      ]}/>
      <Input placeholder="Search…" style={{ maxWidth: 240 }} />
    </div>
    <div className="card" style={{ overflow: "hidden" }}>
      <table className="tbl">
        <thead><tr>
          <th>Voter</th><th>Status</th><th>Topic</th><th>Ballot</th><th style={{ textAlign: "right" }}>Actions</th>
        </tr></thead>
        <tbody>
          {visible.map((v, i) => <tr key={i}>
            <td><div className="row" style={{ gap: 10 }}>
              <Avatar name={v.name} size={26} />
              <div><div style={{ fontWeight: 500 }}>{v.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{v.email}</div></div>
            </div></td>
            <td>{v.status === "approved" ? <Badge tone="success" icon="check">Approved</Badge>
                : v.status === "pending" ? <Badge tone="amber">Pending</Badge>
                : <Badge tone="danger">Rejected</Badge>}</td>
            <td className="muted" style={{ fontSize: 13 }}>Nº {String(v.topic.id).padStart(2, "0")} · {v.topic.philosopher}</td>
            <td>{v.ballot === "submitted" ? <Badge tone="violet" icon="lock">Submitted</Badge>
                : v.ballot === "draft" ? <Badge tone="neutral">Draft</Badge>
                : v.ballot === "not-started" ? <span className="muted">Not started</span>
                : <span className="muted">—</span>}</td>
            <td><div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
              <Button kind="ghost" size="sm">Reassign</Button>
              <Button kind="ghost" size="sm"><Icon name="dots" size={14} /></Button>
            </div></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </AdminShell>;
}

function ScreenAdminTopics({ topics, isMobile }) {
  const [filter, setFilter] = useState("all");
  const tn = useToast();
  const visible = topics.filter(t => filter === "all" || t.status === filter);
  return <AdminShell isMobile={isMobile} title="Topics" sub="Mark topics as presented as the class proceeds.">
    <div className="row" style={{ marginBottom: 12 }}>
      <Chips value={filter} onChange={setFilter} items={[
        { id: "all", label: "All", count: topics.length },
        { id: "unassigned", label: "Unassigned", count: topics.filter(t => t.status === "unassigned").length },
        { id: "assigned", label: "Assigned", count: topics.filter(t => t.status === "assigned").length },
        { id: "presented", label: "Presented", count: topics.filter(t => t.status === "presented").length },
        { id: "published", label: "Published", count: topics.filter(t => t.status === "published").length },
      ]}/>
    </div>
    <div className="card" style={{ overflow: "hidden" }}>
      <table className="tbl">
        <thead><tr>
          <th style={{ width: 70 }}>Nº</th><th>Topic</th><th>State</th><th>Presenter</th><th>Date</th><th style={{ textAlign: "right" }}>Actions</th>
        </tr></thead>
        <tbody>
          {visible.map(t => <tr key={t.id}>
            <td className="mono">{String(t.id).padStart(2, "0")}</td>
            <td><div style={{ fontFamily: "var(--serif)", fontWeight: 600 }}>{t.philosopher}</div>
              <div className="muted" style={{ fontSize: 12 }}>{t.work}</div></td>
            <td>{t.status === "unassigned" ? <Badge tone="neutral">Unassigned</Badge>
                : t.status === "assigned" ? <Badge tone="violet">Assigned</Badge>
                : t.status === "presented" ? <Badge tone="amber">Presented</Badge>
                : <Badge tone="success" icon="check">Published</Badge>}</td>
            <td>{t.presenter || <span className="muted">—</span>}</td>
            <td className="muted">{t.presentedAt ? fmtDate(t.presentedAt) : t.scheduledFor ? fmtDate(t.scheduledFor) : "—"}</td>
            <td><div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
              {t.status === "assigned" && <Button kind="primary" size="sm" onClick={() => tn.push(`Marked Nº ${t.id} presented`, { icon: "check" })}>Mark presented</Button>}
              <Button kind="ghost" size="sm">Edit</Button>
            </div></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </AdminShell>;
}

function ScreenAdminVoting({ isMobile }) {
  const [locked, setLocked] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const tn = useToast();
  return <AdminShell isMobile={isMobile} title="Voting controls" sub="Set the deadline. Lock the ballots. Run the tally.">
    <div className="card card__pad">
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Submission progress</div>
      <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>Live count of ballots cast.</div>
      <div className="row" style={{ marginBottom: 8, gap: 14 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 32, fontWeight: 600, letterSpacing: "-0.01em" }}>14<span className="muted" style={{ fontSize: 18, fontWeight: 400 }}> of 32</span></div>
      </div>
      <div className="irv-bar-track" style={{ height: 10 }}>
        <div className="irv-bar-fill" style={{ width: "44%" }} />
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginTop: 16 }}>
      <div className="card card__pad">
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Deadline</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>When the polls close.</div>
        <Field label="Polls close at"><Input type="datetime-local" defaultValue="2026-05-30T23:00" /></Field>
        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <Button>Save deadline</Button>
          <div className="spacer"/>
          <Button kind="ghost">Open polls now</Button>
        </div>
      </div>

      <div className="card card__pad">
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Lock & tally</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>One-way actions. Take a deep breath.</div>
        <div className="col" style={{ gap: 10 }}>
          <Button kind="solid-danger" disabled={locked} onClick={() => setConfirming(true)}>{locked ? "Ballots locked" : "Lock ballots now"}</Button>
          <Button kind="primary" disabled={!locked} onClick={() => tn.push("Running IRV tally…", { icon: "check" })}>Run tally</Button>
        </div>
      </div>
    </div>

    <Modal open={confirming} onClose={() => setConfirming(false)}>
      <h2>Lock ballots now?</h2>
      <p>14 of 32 voters have submitted. The remaining 18 will lose the chance to vote.</p>
      <p style={{ background: "var(--amber-50)", color: "var(--amber)", padding: "10px 12px", borderRadius: "var(--r)" }}>
        Once locked, no one can submit or change a ballot.
      </p>
      <div className="row" style={{ marginTop: 20, justifyContent: "flex-end", gap: 8 }}>
        <Button kind="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
        <Button kind="solid-danger" onClick={() => { setLocked(true); setConfirming(false); tn.push("Ballots locked", { icon: "lock" }); }}>Lock ballots</Button>
      </div>
    </Modal>
  </AdminShell>;
}

Object.assign(window, { ScreenAdminHome, ScreenAdminApprovals, ScreenAdminVoters, ScreenAdminTopics, ScreenAdminVoting });
