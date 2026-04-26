// Agora — Results (Admin) — full IRV with 5 sequential runs

// Generate plausible IRV data: 5 runs, each eliminating one winner
// (sequential IRV / single transferable round style picked by the brief).
function buildIrvRuns(topics) {
  const published = topics.filter(t => t.status === "published" || t.status === "presented");
  const winners = [
    { id: 5,  rounds: 6 }, // Aquinas
    { id: 25, rounds: 5 }, // Rawls
    { id: 26, rounds: 5 }, // Dworkin
    { id: 24, rounds: 4 }, // Hart
    { id: 16, rounds: 4 }, // Mill
  ];
  const totalVoters = 32;
  return winners.map(({ id, rounds }, ri) => {
    const winner = topics.find(t => t.id === id);
    // pool of contenders for this run = winner + 5 random others (deterministic)
    const others = topics
      .filter(t => t.id !== id && t.status === "published")
      .slice(ri * 3, ri * 3 + 5);
    const pool = [winner, ...others];
    // round-by-round counts: candidates start with seeded support, eliminated each round
    const out = [];
    let alive = pool.map((t, i) => ({ t, votes: [10, 7, 6, 4, 3, 2][i] || 1 }));
    for (let r = 0; r < rounds; r++) {
      const total = alive.reduce((a, c) => a + c.votes, 0);
      const sorted = [...alive].sort((a, b) => b.votes - a.votes);
      const eliminated = sorted[sorted.length - 1];
      out.push({
        round: r + 1,
        total,
        rows: sorted.map(c => ({
          id: c.t.id, name: c.t.philosopher, art: c.t.artTitle || c.t.work, tint: c.t.tint,
          votes: c.votes, pct: Math.round(c.votes / total * 100),
          eliminated: c.t.id === eliminated.t.id && r < rounds - 1,
          winner: r === rounds - 1 && c.t.id === winner.id,
        })),
        eliminatedId: r < rounds - 1 ? eliminated.t.id : null,
      });
      if (r < rounds - 1) {
        // redistribute eliminated's votes to the rest
        const elim = alive.find(c => c.t.id === eliminated.t.id);
        const remaining = alive.filter(c => c.t.id !== eliminated.t.id);
        remaining.forEach((c, i) => { c.votes += i === 0 ? Math.ceil(elim.votes * 0.6) : Math.floor(elim.votes * 0.4 / Math.max(1, remaining.length - 1)); });
        alive = remaining;
      }
    }
    return { winnerId: id, winner, rounds: out, totalVoters };
  });
}

function ScreenResults({ topics, isMobile }) {
  const runs = useMemo(() => buildIrvRuns(topics), [topics]);
  const [activeRun, setActiveRun] = useState(0);
  const top5 = runs.map(r => r.winner);
  const tn = useToast();

  return <div className="results-mesh" style={{ minHeight: "100%" }}>
    <div style={{ padding: isMobile ? "16px 16px 24px" : "32px 32px 40px", maxWidth: 1240, margin: "0 auto" }}>
      <div className="row" style={{ marginBottom: 6 }}>
        <Badge tone="navy" icon="shield">Beadle</Badge>
        <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>Tally completed · 30 May, 23:14</span>
        <div className="spacer"/>
        <Button kind="secondary" icon="external" size="sm" onClick={() => tn.push("Exporting CSV…")}>Export CSV</Button>
        <Button kind="ghost" icon="file" size="sm" onClick={() => tn.push("Exporting PDF…")} style={{ marginLeft: 6 }}>Export PDF</Button>
      </div>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: isMobile ? 30 : 42, fontWeight: 600, margin: "8px 0 6px", letterSpacing: "-0.02em" }}>
        The class chose its top five.
      </h1>
      <div className="muted" style={{ marginBottom: 28 }}>Sequential IRV across 32 ballots · 5 runs · 24 rounds total.</div>

      {/* Podium */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 16, marginBottom: 36 }}>
        {top5.map((t, i) => <div key={t.id} className="card" style={{ overflow: "hidden", cursor: "pointer", transform: !isMobile ? `translateY(${[0, 10, 20, 30, 40][i]}px)` : "none" }} onClick={() => setActiveRun(i)}>
          <div style={{ aspectRatio: "1 / 1" }}><ArtPlaceholder topic={t} /></div>
          <div style={{ padding: 14 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
              <div className="mono" style={{ fontSize: 11, color: "var(--text-2)", letterSpacing: "0.08em" }}>RUN {i + 1}</div>
              <Badge tone={i === 0 ? "amber" : "navy"} icon={i === 0 ? "trophy" : null}>#{i + 1}</Badge>
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 600, lineHeight: 1.2 }}>{t.philosopher}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t.artTitle || t.work}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>by {t.presenter}</div>
          </div>
        </div>)}
      </div>

      {/* Run tabs */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="tabs" style={{ paddingLeft: 12 }}>
          {runs.map((r, i) => <div key={i}
            className={`tab ${activeRun === i ? "tab--active" : ""}`}
            onClick={() => setActiveRun(i)}>
            Run {i + 1}: #{i + 1} <span className="muted" style={{ marginLeft: 6 }}>{r.winner.philosopher}</span>
          </div>)}
        </div>
        <div style={{ padding: isMobile ? 16 : 24 }}>
          <RunTimeline run={runs[activeRun]} isMobile={isMobile} />
        </div>
      </div>
    </div>
  </div>;
}

function RunTimeline({ run, isMobile }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(false); const k = setTimeout(() => setReady(true), 60); return () => clearTimeout(k); }, [run]);
  return <div>
    <div className="row" style={{ marginBottom: 18, gap: 16, flexWrap: "wrap" }}>
      <div>
        <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>Winner</div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600 }}>{run.winner.philosopher}</div>
        <div className="muted" style={{ fontSize: 13 }}>{run.winner.artTitle || run.winner.work} · by {run.winner.presenter}</div>
      </div>
      <div className="spacer"/>
      <div className="row" style={{ gap: 16 }}>
        <Stat label="Rounds" value={run.rounds.length} />
        <Stat label="First-round leader" value={run.rounds[0].rows[0].name.split(" ").slice(-1)[0]} />
        <Stat label="Decided in" value={`Round ${run.rounds.length}`} />
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "180px 1fr", gap: 24 }}>
      {/* Vertical timeline */}
      {run.rounds.map((rd, idx) => <React.Fragment key={idx}>
        <div style={{ position: "relative", paddingLeft: isMobile ? 0 : 8 }}>
          <div className="row" style={{ gap: 10, alignItems: "baseline" }}>
            <div style={{
              width: 32, height: 32, borderRadius: 999, background: rd.rows.find(r => r.winner) ? "var(--success)" : "var(--navy)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--mono)", fontWeight: 600, fontSize: 13, flex: "none",
            }}>{rd.round}</div>
            <div>
              <div style={{ fontWeight: 600 }}>Round {rd.round}</div>
              <div className="muted" style={{ fontSize: 12 }}>{rd.total} votes counted</div>
            </div>
          </div>
          {idx < run.rounds.length - 1 && <div style={{ marginLeft: 16, marginTop: 8, height: 24, width: 2, background: "var(--line)" }}/>}
        </div>
        <div className="card card__pad" style={{ padding: 16, marginBottom: idx < run.rounds.length - 1 ? 0 : 0 }}>
          {rd.rows.map(r => <div key={r.id} className="row" style={{ gap: 12, padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}>
            <div className="rank-thumb" style={{ background: r.tint.bg, color: r.tint.ink, width: 30, height: 30, fontSize: 13 }}>
              {r.name.split(" ").slice(-1)[0][0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: r.winner ? 600 : 500, fontSize: 14, minWidth: 0,
                  textDecoration: r.eliminated ? "line-through" : "none",
                  color: r.eliminated ? "var(--text-2)" : "var(--text)" }}>
                  {r.name} {r.eliminated && <span className="muted" style={{ fontSize: 11 }}>· eliminated, redistributed</span>}
                </div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{r.votes} <span className="muted" style={{ fontWeight: 400 }}>· {r.pct}%</span></div>
              </div>
              <div style={{ marginTop: 4 }} className="irv-bar-track">
                <div className={`irv-bar-fill ${r.winner ? "irv-bar-fill--winner" : r.eliminated ? "irv-bar-fill--out" : ""}`}
                  style={{ width: ready ? `${r.pct}%` : "0%" }} />
              </div>
            </div>
          </div>)}
          {rd.eliminatedId != null && <div className="muted" style={{ fontSize: 12, paddingTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="arrow-r" size={12}/> {rd.rows.find(r => r.id === rd.eliminatedId).name}'s {rd.rows.find(r => r.id === rd.eliminatedId).votes} votes redistribute to next preferences in Round {rd.round + 1}.
          </div>}
        </div>
      </React.Fragment>)}
    </div>
  </div>;
}

function Stat({ label, value }) {
  return <div>
    <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 600 }}>{value}</div>
  </div>;
}

Object.assign(window, { ScreenResults });
