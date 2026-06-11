import { useEffect, useMemo, useState } from 'react';
import { SYSTEMS } from '../geo/systems';
import { infoOf, VehicleInfo } from '../sim/transit';
import { useApp } from '../sim/store';
import { getViewPresets } from './views';

const sysMeta = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));

function Clock() {
  const [now, setNow] = useState(() => new Date());
  const night = useApp((s) => s.night);
  const toggleNight = useApp((s) => s.toggleNight);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="panel clock">
      <span className="live-dot" />
      LIVE&nbsp;·&nbsp;
      {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
      <button className="night-btn" onClick={toggleNight} title={night ? 'Day mode' : 'Night mode'}>
        {night ? '☀️' : '🌙'}
      </button>
    </div>
  );
}

function Legend() {
  const visible = useApp((s) => s.visible);
  const toggle = useApp((s) => s.toggle);
  return (
    <div className="panel legend">
      {SYSTEMS.map((s) => (
        <label key={s.id} className="legend-row">
          <input type="checkbox" checked={visible[s.id]} onChange={() => toggle(s.id)} />
          <span className="chip" style={{ background: s.color }} />
          <span className="legend-emoji">{s.emoji}</span>
          {s.label}
        </label>
      ))}
    </div>
  );
}

function Views() {
  const setFlyTo = useApp((s) => s.setFlyTo);
  const presets = useMemo(() => getViewPresets(), []);
  return (
    <div className="panel views">
      <div className="views-title">Jump to</div>
      {presets.map((p) => (
        <button key={p.id} className="view-btn" onClick={() => setFlyTo(p.fly)}>
          <span className="view-emoji">{p.emoji}</span>
          {p.label}
        </button>
      ))}
    </div>
  );
}

function InfoCard() {
  const followedId = useApp((s) => s.followedId);
  const setFollowed = useApp((s) => s.setFollowed);
  const [info, setInfo] = useState<VehicleInfo | null>(null);

  useEffect(() => {
    if (!followedId) {
      setInfo(null);
      return;
    }
    const update = () => setInfo(infoOf(followedId));
    update();
    const t = setInterval(update, 250);
    return () => clearInterval(t);
  }, [followedId]);

  if (!info) return null;
  const meta = sysMeta[info.system];
  return (
    <div className="panel info-card">
      <div className="info-head">
        <span className="info-emoji">{meta.emoji}</span>
        <span className="route-badge" style={{ background: meta.color }}>
          {info.routeName}
        </span>
        <button className="close-btn" onClick={() => setFollowed(null)} title="Stop following">
          ✕
        </button>
      </div>
      <div className="info-body">
        <div>
          <div className="info-label">Vehicle</div>
          <div className="info-value">{info.label}</div>
        </div>
        <div>
          <div className="info-label">Speed</div>
          <div className="info-value">{info.dwelling ? 'at stop' : `~${info.speedMph} mph`}</div>
        </div>
        <div>
          <div className="info-label">Next stop</div>
          <div className="info-value">{info.nextStop}</div>
        </div>
      </div>
      <div className="info-hint">following · click water or press ✕ to let go</div>
    </div>
  );
}

export function Hud() {
  return (
    <>
      <div className="panel title">
        <div className="title-main">🌉 SF Transit</div>
        <div className="title-sub">live(ish) · simulated feed</div>
      </div>
      <Clock />
      <Legend />
      <Views />
      <InfoCard />
      <div className="hint">drag to pan · right-drag to rotate · scroll to zoom · click a vehicle to follow it</div>
    </>
  );
}
