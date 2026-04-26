const SWATCHES = [
  { name: "Navy", value: "#0A2540" },
  { name: "Violet", value: "#635BFF" },
  { name: "Amber", value: "#B8860B" },
  { name: "Surface", value: "#F6F9FC" },
  { name: "Text", value: "#1A1F36" },
  { name: "Text 2", value: "#64748B" },
  { name: "Line", value: "#E3E8EE" },
  { name: "Danger", value: "#C0382B" },
  { name: "Success", value: "#1A7F4F" },
];

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="font-serif text-5xl font-semibold tracking-tight text-navy">
        Agora
      </h1>
      <p className="text-text-2 text-base">Phase 1 ready</p>
      <div className="flex flex-wrap gap-3 justify-center max-w-md">
        {SWATCHES.map((s) => (
          <div key={s.name} className="flex flex-col items-center gap-1">
            <div
              className="w-10 h-10 rounded border border-line"
              style={{ backgroundColor: s.value }}
            />
            <span className="text-xs text-text-2">{s.name}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
