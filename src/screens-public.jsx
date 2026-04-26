// Agora — Public (pre-auth) screens

function ScreenLanding({ go }) {
  return <div className="hero-mesh" style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
    <div style={{ padding: "20px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <AgoraWordmark size={20} />
      <div className="row" style={{ gap: 8 }}>
        <Button kind="ghost" onClick={() => go("signin")}>Sign in</Button>
        <Button kind="primary" onClick={() => go("register")}>Register</Button>
      </div>
    </div>
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ maxWidth: 720, textAlign: "center" }}>
        <div style={{ fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.12em", color: "var(--text-2)", textTransform: "uppercase", marginBottom: 24 }}>
          San Beda College Alabang · JDN101
        </div>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(40px, 6vw, 64px)", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.05, margin: 0 }}>
          Ranked-choice voting<br/>
          for Philosophy of Law.
        </h1>
        <p style={{ fontSize: 17, color: "var(--text-2)", lineHeight: 1.55, marginTop: 20, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
          One philosopher. One piece of art. Five minutes at the front of the room.
          Agora is the gallery you build together — and the ballot you settle it with.
        </p>
        <div className="row" style={{ justifyContent: "center", gap: 10, marginTop: 32 }}>
          <Button kind="primary" size="lg" icon="arrow-r" onClick={() => go("register")}>Create account</Button>
          <Button kind="secondary" size="lg" onClick={() => go("signin")}>I already have one</Button>
        </div>
        <div className="row" style={{ justifyContent: "center", gap: 24, marginTop: 64, color: "var(--text-2)", fontSize: 13 }}>
          <div>32 topics</div><div>·</div><div>Sequential IRV</div><div>·</div><div>Beadle-mediated</div>
        </div>
      </div>
    </div>
    <div style={{ borderTop: "1px solid var(--line)", padding: "20px 32px", color: "var(--text-2)", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
      <span>Built for the JDN101 cohort, A.Y. 2025–26</span>
      <span>Beadles: Lim, Cruz</span>
    </div>
  </div>;
}

function PublicCard({ title, children, footer }) {
  return <div className="hero-mesh" style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
    <div style={{ width: "100%", maxWidth: 420 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <AgoraWordmark size={20} />
      </div>
      <div className="card card__pad" style={{ padding: 28 }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-0.01em" }}>{title}</h2>
        {children}
      </div>
      {footer && <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--text-2)" }}>{footer}</div>}
    </div>
  </div>;
}

function ScreenRegister({ go }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sid, setSid] = useState("");
  return <PublicCard title="Create your account"
    footer={<>Already have an account? <a style={{ color: "var(--violet-600)", cursor: "pointer" }} onClick={() => go("signin")}>Sign in</a></>}>
    <p style={{ color: "var(--text-2)", margin: "0 0 20px" }}>Your beadle will approve your account before you can vote.</p>
    <div className="col" style={{ gap: 14 }}>
      <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="As enrolled" /></Field>
      <Field label="School email" hint="@sanbeda.edu.ph"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@sanbeda.edu.ph" /></Field>
      <Field label="Student ID"><Input value={sid} onChange={(e) => setSid(e.target.value)} placeholder="2024-0000" /></Field>
      <Button kind="primary" size="lg" block onClick={() => go("await-email")}>Create account</Button>
    </div>
  </PublicCard>;
}

function ScreenSignin({ go }) {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  return <PublicCard title={sent ? "Check your inbox" : "Sign in"}
    footer={!sent && <>New here? <a style={{ color: "var(--violet-600)", cursor: "pointer" }} onClick={() => go("register")}>Register</a></>}>
    {!sent ? <>
      <p style={{ color: "var(--text-2)", margin: "0 0 20px" }}>We'll send a one-time link to your school email.</p>
      <div className="col" style={{ gap: 14 }}>
        <Field label="School email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@sanbeda.edu.ph" /></Field>
        <Button kind="primary" size="lg" block onClick={() => setSent(true)}>Send magic link</Button>
      </div>
    </> : <>
      <p style={{ color: "var(--text-2)", margin: "0 0 20px" }}>
        We sent a sign-in link to <b style={{ color: "var(--text)" }}>{email.replace(/(.).+(@.+)/, "$1•••$2") || "a•••@sanbeda.edu.ph"}</b>.
        It expires in 15 minutes.
      </p>
      <Button kind="secondary" block onClick={() => go("dashboard")}>I clicked the link · Continue</Button>
    </>}
  </PublicCard>;
}

function ScreenAwaitEmail({ go }) {
  return <PublicCard title="Confirm your email"
    footer={<a style={{ color: "var(--violet-600)", cursor: "pointer" }} onClick={() => go("signin")}>Resend the link</a>}>
    <p style={{ color: "var(--text-2)", margin: "0 0 20px" }}>
      We sent a confirmation link to your school inbox. Open it on this device to finish.
    </p>
    <div style={{ background: "var(--surface-alt)", borderRadius: "var(--r)", padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
      <Icon name="info" size={18} />
      <div style={{ fontSize: 13 }}>Once confirmed, your beadle has up to 24 hours to approve.</div>
    </div>
    <div style={{ marginTop: 20 }}>
      <Button kind="secondary" block onClick={() => go("await-approval")}>I confirmed · Continue</Button>
    </div>
  </PublicCard>;
}

function ScreenAwaitApproval({ go }) {
  return <PublicCard title="Pending approval">
    <p style={{ color: "var(--text-2)", margin: "0 0 20px" }}>
      Your beadle will review shortly. You'll get an email when it's done — usually within the day.
    </p>
    <div style={{ display: "flex", gap: 12, padding: 14, background: "var(--surface-alt)", borderRadius: "var(--r)" }}>
      <Avatar name={ME.name} size={32} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500 }}>{ME.name}</div>
        <div className="muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>{ME.email}</div>
      </div>
    </div>
    <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
      <Button kind="ghost" onClick={() => go("landing")}>Sign out</Button>
      <div className="spacer" />
      <Button kind="secondary" onClick={() => go("dashboard")}>Skip for preview</Button>
    </div>
  </PublicCard>;
}

function ScreenRejected({ go }) {
  return <PublicCard title="Account not approved">
    <p style={{ color: "var(--text-2)", margin: "0 0 16px" }}>
      Your beadle did not approve this registration. If you think it's a mistake, reach out below — usually it's a mismatched student ID.
    </p>
    <div style={{ background: "var(--surface-alt)", borderRadius: "var(--r)", padding: 14, fontSize: 13 }}>
      <div style={{ fontWeight: 500, marginBottom: 4 }}>Contact your beadle</div>
      <div className="muted">Beadle Lim · jlim@sanbeda.edu.ph</div>
      <div className="muted">Beadle Cruz · mcruz@sanbeda.edu.ph</div>
    </div>
    <div style={{ marginTop: 20 }}>
      <Button kind="secondary" block onClick={() => go("landing")}>Sign out</Button>
    </div>
  </PublicCard>;
}

Object.assign(window, {
  ScreenLanding, ScreenRegister, ScreenSignin,
  ScreenAwaitEmail, ScreenAwaitApproval, ScreenRejected,
});
