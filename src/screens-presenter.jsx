// Agora — Presenter upload screen

function ScreenUpload({ topics, setRoute, isMobile }) {
  const t = topics.find(x => x.id === ME.topicId) || topics[0];
  const [artTitle, setArtTitle] = useState(t.artTitle || "The Cave at Dawn");
  const [explanation, setExplanation] = useState(t.explanation || "");
  const [hasFile, setHasFile] = useState(t.status === "published");
  const [dragOver, setDragOver] = useState(false);
  const tn = useToast();

  const sentenceCount = (explanation.match(/[.!?]+(\s|$)/g) || []).length;
  const sentenceTone = sentenceCount >= 5 && sentenceCount <= 7 ? "success" :
    (sentenceCount > 0 ? "amber" : "neutral");

  const previewTopic = { ...t, status: "published",
    artTitle: artTitle || t.artTitle || "Untitled",
    explanation: explanation || t.explanation,
  };

  return <div style={{ padding: isMobile ? "16px 16px 32px" : "24px 32px 40px", maxWidth: 1100, margin: "0 auto" }}>
    <Button kind="ghost" size="sm" icon="chev-l" onClick={() => setRoute("dashboard")}>Back to gallery</Button>
    <div style={{ marginTop: 12, marginBottom: 24 }}>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: isMobile ? 26 : 32, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
        {hasFile ? "Edit your presentation" : "Upload your presentation"}
      </h1>
      <div className="muted" style={{ marginTop: 6 }}>
        Topic Nº {String(t.id).padStart(2, "0")} · <b style={{ color: "var(--text)" }}>{t.philosopher}</b> · {t.work}
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 24 }}>
      <div className="col" style={{ gap: 16 }}>
        <div className="card card__pad">
          <Field label="Art title" hint="A short title for the work itself.">
            <Input value={artTitle} onChange={(e) => setArtTitle(e.target.value)} placeholder="e.g. The Cave at Dawn" />
          </Field>
        </div>

        <div className="card card__pad">
          <div className="field__label" style={{ marginBottom: 6 }}>Artwork</div>
          <div className="field__hint" style={{ marginBottom: 10 }}>JPG, PNG, WEBP, HEIC or PDF · 10 MB max. PDFs use the first page as preview.</div>
          {!hasFile ? <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); setHasFile(true); }}
            style={{
              border: `2px dashed ${dragOver ? "var(--violet)" : "var(--line)"}`,
              background: dragOver ? "var(--violet-100)" : "var(--surface-alt)",
              borderRadius: "var(--r-lg)", padding: 36, textAlign: "center",
              transition: "all 120ms ease-out",
            }}>
            <div style={{ marginBottom: 8 }}><Icon name="upload" size={24} stroke={1.4} /></div>
            <div style={{ fontWeight: 500 }}>Drop a file here, or <a style={{ color: "var(--violet-600)", cursor: "pointer" }} onClick={() => setHasFile(true)}>browse</a></div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>One file. You can replace it later.</div>
          </div> : <div className="row" style={{ gap: 14, padding: 14, background: "var(--surface-alt)", borderRadius: "var(--r)", border: "1px solid var(--line-2)" }}>
            <div style={{ width: 56, height: 56, borderRadius: 4, overflow: "hidden", flex: "none" }}>
              <ArtPlaceholder topic={t} showLabel={false} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>plato-cave-at-dawn.png</div>
              <div className="muted" style={{ fontSize: 12 }}>2.4 MB · uploaded just now</div>
            </div>
            <Button kind="ghost" size="sm" onClick={() => setHasFile(false)}>Replace</Button>
          </div>}
        </div>

        <div className="card card__pad">
          <Field
            label={<span className="row" style={{ justifyContent: "space-between", width: "100%" }}>
              <span>Explanation</span>
              <Badge tone={sentenceTone}>{sentenceCount} of 5–7 sentences</Badge>
            </span>}
            hint="A single paragraph. Conversational. What is the philosopher claiming, and what does the art ask us to see?">
            <Textarea value={explanation} onChange={(e) => setExplanation(e.target.value)}
              rows={8} placeholder="Begin with the central claim, then bring the artwork in alongside it."/>
          </Field>
        </div>

        <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
          <Button kind="ghost" onClick={() => setRoute("dashboard")}>Cancel</Button>
          <Button kind="primary" onClick={() => { tn.push("Topic published to gallery", { icon: "check" }); setRoute("dashboard"); }}>
            {hasFile ? "Save and publish" : "Save draft"}
          </Button>
        </div>
      </div>

      <div className="col" style={{ gap: 16 }}>
        <div style={{ position: "sticky", top: 16 }}>
          <div className="mono muted" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Live preview · gallery card</div>
          <TopicCard topic={previewTopic} isMine onOpen={() => {}} />
          <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>This is how your card will appear on every voter's dashboard.</div>
        </div>
      </div>
    </div>
  </div>;
}

Object.assign(window, { ScreenUpload });
