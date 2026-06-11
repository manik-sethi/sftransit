import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { SYSTEMS, SystemId } from '../geo/systems';
import { infoOf, poseCar, vehicles, VehicleInfo } from '../sim/transit';
import { liveInfoOf, liveStatus, liveVehicles, LiveInfo } from '../sim/live';
import { lineRefOfRoute } from '../geo/colors';
import { useApp, queryTokens, matchesQuery } from '../sim/store';
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

function matchPositions(tokens: string[], mode: 'live' | 'demo'): [number, number][] {
  const out: [number, number][] = [];
  if (mode === 'live') {
    for (const v of liveVehicles.values()) {
      if (matchesQuery(tokens, v.line)) out.push([v.x, v.z]);
    }
  } else {
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    for (const v of vehicles) {
      if (matchesQuery(tokens, lineRefOfRoute(v.route.def.id, v.route.def.system as SystemId))) {
        poseCar(v, 0, 0, pos, quat);
        out.push([pos.x, pos.z]);
      }
    }
  }
  return out;
}

function LineSearch() {
  const lineQuery = useApp((s) => s.lineQuery);
  const setLineQuery = useApp((s) => s.setLineQuery);
  const setFlyTo = useApp((s) => s.setFlyTo);
  const mode = useApp((s) => s.mode);
  const [count, setCount] = useState<number | null>(null);

  const tokens = useMemo(() => queryTokens(lineQuery), [lineQuery]);

  useEffect(() => {
    if (!tokens.length) {
      setCount(null);
      return;
    }
    const update = () => setCount(matchPositions(tokens, mode).length);
    update();
    const t = setInterval(update, 2000);
    return () => clearInterval(t);
  }, [tokens, mode]);

  const flyToMatches = () => {
    const pts = matchPositions(tokens, mode);
    if (!pts.length) return;
    let cx = 0;
    let cz = 0;
    for (const [x, z] of pts) {
      cx += x;
      cz += z;
    }
    cx /= pts.length;
    cz /= pts.length;
    // distance scaled to the spread of the matches
    let r = 12;
    for (const [x, z] of pts) r = Math.max(r, Math.hypot(x - cx, z - cz) * 1.3);
    const dist = Math.min(160, r + 14);
    setFlyTo({ pos: [cx + dist * 0.55, dist * 0.85, cz + dist * 0.55], target: [cx, 0, cz] });
  };

  return (
    <div className="panel search">
      <input
        type="text"
        value={lineQuery}
        onChange={(e) => setLineQuery(e.target.value)}
        placeholder="find lines… e.g. 48, 24"
        spellCheck={false}
      />
      {tokens.length > 0 && (
        <div className="search-row">
          <span className="search-count">
            {count === null ? '…' : `${count} vehicle${count === 1 ? '' : 's'}`}
          </span>
          <button className="mode-btn" onClick={flyToMatches} disabled={!count}>
            fly to them
          </button>
          <button className="mode-btn" onClick={() => setLineQuery('')}>
            clear
          </button>
        </div>
      )}
    </div>
  );
}

function InfoCard() {
  const followedId = useApp((s) => s.followedId);
  const setFollowed = useApp((s) => s.setFollowed);
  const [info, setInfo] = useState<VehicleInfo | null>(null);
  const [live, setLive] = useState<LiveInfo | null>(null);

  useEffect(() => {
    if (!followedId) {
      setInfo(null);
      setLive(null);
      return;
    }
    const update = () => {
      if (followedId.startsWith('live:')) {
        setLive(liveInfoOf(followedId.slice(5)));
        setInfo(null);
      } else {
        setInfo(infoOf(followedId));
        setLive(null);
      }
    };
    update();
    const t = setInterval(update, 250);
    return () => clearInterval(t);
  }, [followedId]);

  const meta = sysMeta[(live ?? info)?.system ?? 'bus'];
  if (live) {
    return (
      <div className="panel info-card">
        <div className="info-head">
          <span className="info-emoji">{meta.emoji}</span>
          <span className="route-badge" style={{ background: meta.color }}>
            {live.line}
          </span>
          <button className="close-btn" onClick={() => setFollowed(null)} title="Stop following">
            ✕
          </button>
        </div>
        <div className="info-body">
          <div>
            <div className="info-label">Vehicle</div>
            <div className="info-value">#{live.ref}</div>
          </div>
          <div>
            <div className="info-label">To</div>
            <div className="info-value">{live.dest}</div>
          </div>
          {live.occ && (
            <div>
              <div className="info-label">Occupancy</div>
              <div className="info-value">{live.occ}</div>
            </div>
          )}
          <div>
            <div className="info-label">Updated</div>
            <div className="info-value">{live.ageSec < 5 ? 'just now' : `${live.ageSec}s ago`}</div>
          </div>
        </div>
        <div className="info-hint">real 511 vehicle · click water or press ✕ to let go</div>
      </div>
    );
  }
  if (!info) return null;
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

function LiveStatusLine() {
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const [, bump] = useState(0);
  useEffect(() => {
    const t = setInterval(() => bump((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  let text: string;
  if (mode === 'demo') {
    text = 'simulated demo';
  } else if (!liveStatus.everConnected) {
    text = liveStatus.error ? `live feed: ${liveStatus.error}` : 'connecting to 511…';
  } else {
    const age = Math.round((Date.now() - liveStatus.lastUpdate) / 1000);
    text = `${liveStatus.count} vehicles · 511 data · ${age < 5 ? 'just now' : `${age}s ago`}`;
  }
  return (
    <div className="title-sub">
      {text}
      <button className="mode-btn" onClick={() => setMode(mode === 'live' ? 'demo' : 'live')}>
        {mode === 'live' ? 'switch to demo' : 'go live'}
      </button>
    </div>
  );
}

export function Hud() {
  return (
    <>
      <div className="panel title">
        <div className="title-main">🌉 SF Transit</div>
        <LiveStatusLine />
      </div>
      <Clock />
      <LineSearch />
      <Legend />
      <Views />
      <InfoCard />
      <div className="hint">drag to pan · right-drag to rotate · scroll to zoom · click a vehicle to follow it</div>
    </>
  );
}
