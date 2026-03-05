type HeroPanelProps = {
  visitedCount: number;
  mappedCount: number;
};

export default function HeroPanel({ visitedCount, mappedCount }: HeroPanelProps) {
  return (
    <header className="hero-panel">
      <p className="eyebrow">Edinburgh</p>
      <h1>Callum's Pub Atlas</h1>
      <p className="subtitle">A personal map of pints around Edinburgh.</p>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stats-value">{visitedCount}</span>
          <span className="stats-label">Visited</span>
        </div>
        <div className="stat-card">
          <span className="stats-value">{mappedCount}</span>
          <span className="stats-label">Mapped</span>
        </div>
      </div>
    </header>
  );
}
