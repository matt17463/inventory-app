import { Link, useLocation } from 'react-router-dom';
import { shouldSimulateWrites } from './lib/testingMode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { callService, createConnection, getAuth, subscribeEntities } from 'home-assistant-js-websocket';
import { supabase } from './supabaseClient';
import { BUSINESS_HA, PRIVATE_HA, PI_DESKTOP, MAC_DESKTOP, controlFor, entityPresentation, equipment, validHaUrl } from './lib/equipment';
import './EquipmentCenter.css';

const defaultSettings = { haUrl: PRIVATE_HA, photos: {}, mappings: {} };
function cameraImageUrl(entity, baseUrl, refresh) {
  if (!entity?.entity_id?.startsWith('camera.') || !entity.attributes?.entity_picture) return '';
  if (['unknown', 'unavailable'].includes(entity.state)) return '';
  try {
    const base = new URL(baseUrl);
    const path = entity.attributes.entity_picture;
    if (typeof path !== 'string' || !path.startsWith('/api/camera_proxy/')) return '';
    const url = new URL(path, base);
    if (url.origin !== base.origin || url.pathname !== '/api/camera_proxy/' + entity.entity_id) return '';
    // Retain Home Assistant's short-lived signed token, if provided.
    url.searchParams.set('_sc_snapshot', String(refresh));
    return url.toString();
  } catch { return ''; }
}
function CameraPreviews({ cameraEntities, baseUrl, refresh, name, category }) {
  if (!cameraEntities.length) return null;
  return <div className="eq-camera-stack">
    {cameraEntities.map((camera, index) => {
      const src = cameraImageUrl(camera, baseUrl, refresh);
      return <div className="eq-camera-item" key={camera.entity_id}>
        <span className="eq-camera-label">{camera.attributes?.friendly_name || (cameraEntities.length > 1 ? `Camera ${index+1}` : name)}</span>
        {src ? <a href={`${baseUrl}/skilled-crafting/${category === "Security" ? "security" : "business"}`} target="_blank" rel="noopener noreferrer" title="Open camera in Home Assistant">
          <img src={src} alt={`${name}: ${camera.attributes?.friendly_name || 'camera'} snapshot`} loading="lazy" referrerPolicy="no-referrer" />
          <span>Snapshot preview · Open live camera in Home Assistant ↗</span>
        </a> : <p className="eq-camera-unavailable">No snapshot supplied · Open the camera in Home Assistant</p>}
      </div>;
    })}
  </div>;
}

function External({ href, children, ...props }) {
  return <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" {...props}>{children}<span aria-hidden="true"> ↗</span></a>;
}

export default function EquipmentCenter() {
  const location = useLocation();
  const shopDisplay = location.pathname === '/shop-equipment';
  const callbackPath = shopDisplay ? '/shop-equipment' : '/equipment-center';
  const [tvMode, setTvMode] = useState(new URLSearchParams(location.search).get('mode') === 'tv');
  const [kiosk, setKiosk] = useState(new URLSearchParams(location.search).get('kiosk') === '1');
  useEffect(() => {
    document.body.classList.toggle('shop-touch-kiosk-active', kiosk);
    return () => document.body.classList.remove('shop-touch-kiosk-active');
  }, [kiosk]);
  const [site, setSite] = useState('business');
  const [query, setQuery] = useState('');
  const [settings, setSettings] = useState(defaultSettings);
  const [accountKey, setAccountKey] = useState('');
  const [editing, setEditing] = useState(false);
  const [entities, setEntities] = useState({});
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [cameraRefresh, setCameraRefresh] = useState(0);
  const [confirmation, setConfirmation] = useState(null);
  const [selected, setSelected] = useState(null);
  useEffect(() => { if (!connected) return undefined; const id = window.setInterval(() => setCameraRefresh((n) => n + 1), 20000); return () => window.clearInterval(id); }, [connected]);
  const connection = useRef(null);
  const auth = useRef(null);
  const unsubscribe = useRef(null);
  const alive = useRef(true);
  const currentAccount = useRef(null);
  const generation = useRef(0);

  const disconnect = useCallback(() => {
    generation.current += 1;
    unsubscribe.current?.();
    unsubscribe.current = null;
    connection.current?.close();
    connection.current = null;
    auth.current?.revoke().catch(() => {});
    auth.current = null;
    setConnected(false);
    setEntities({});
    setLastUpdate(null);
    setBusy(false);
  }, []);

  const connect = useCallback(async (url, callback = false) => {
    const attempt = ++generation.current;
    let authTimer;
    setBusy(true); setMessage('');
    try {
      const hassUrl = validHaUrl(url, window.location.protocol === 'https:');
      const authorizationRequest = getAuth({ hassUrl, clientId: window.location.origin, redirectUrl: `${window.location.origin}${callbackPath}`, limitHassInstance: true, saveTokens: () => {}, loadTokens: async () => undefined }).then((result) => {
        if (!alive.current || attempt !== generation.current) result.revoke().catch(() => {});
        return result;
      });
      const authorization = await Promise.race([authorizationRequest, new Promise((_, reject) => { authTimer = window.setTimeout(() => reject(new Error('Home Assistant authorization timed out. Check Tailscale and connect again.')), 30000); })]);
      if (!alive.current || attempt !== generation.current) { authorization.revoke().catch(() => {}); return; }
      auth.current = authorization;
      const conn = await createConnection({ auth: authorization, connectTimeout: 10000 });
      if (!alive.current || attempt !== generation.current) { conn.close(); authorization.revoke().catch(() => {}); return; }
      connection.current?.close();
      unsubscribe.current?.();
      connection.current = conn;
      conn.addEventListener('disconnected', () => { if (alive.current && attempt === generation.current) { setConnected(false); setEntities({}); setMessage('Home Assistant disconnected. Waiting for its connection to return.'); } });
      conn.addEventListener('ready', () => { if (alive.current && attempt === generation.current) { setConnected(true); setMessage(''); } });
      unsubscribe.current = subscribeEntities(conn, (next) => { if (alive.current && attempt === generation.current) { setEntities(next); setLastUpdate(new Date()); setConnected(true); } });
      setConnected(true);
      if (callback) window.history.replaceState({}, '', callbackPath);
    } catch (error) {
      if (alive.current && attempt === generation.current) { disconnect(); setMessage(error?.message || 'Could not connect. Check Tailscale, the private HTTPS address, and Home Assistant sign-in.'); }
    } finally { window.clearTimeout(authTimer); if (alive.current && attempt === generation.current) setBusy(false); }
  }, [disconnect, callbackPath]);

  useEffect(() => {
    let effectActive = true;
    alive.current = true;
    currentAccount.current = null;
    const loadAccount = (user) => {
      const id = user?.id || '';
      if (!effectActive || !alive.current || currentAccount.current === id) return;
      currentAccount.current = id;
      disconnect();
      const key = id ? `sc_equipment_v1:${id}` : '';
      setAccountKey(key);
      let saved = defaultSettings;
      try { saved = { ...defaultSettings, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { /* use defaults */ }
      saved.photos = saved.photos && typeof saved.photos === 'object' ? saved.photos : {};
      saved.mappings = saved.mappings && typeof saved.mappings === 'object' ? saved.mappings : {};
      setSettings(saved);
      if (id && new URLSearchParams(window.location.search).has('auth_callback')) connect(saved.haUrl, true);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => loadAccount(session?.user));
    supabase.auth.getUser().then(({ data }) => loadAccount(data?.user)).catch(() => setMessage('Sign in to Skilled Crafting before connecting live.'));
    return () => { effectActive = false; alive.current = false; generation.current += 1; subscription.unsubscribe(); unsubscribe.current?.(); connection.current?.close(); auth.current?.revoke().catch(() => {}); auth.current = null; };
  }, [connect, disconnect]);

  function saveSettings(event) {
    event.preventDefault();
    try {
      validHaUrl(settings.haUrl, false);
      if (accountKey) localStorage.setItem(accountKey, JSON.stringify(settings));
      disconnect(); setEditing(false); setMessage('Connection preferences saved on this browser. Connect live to sign in with Home Assistant.');
    } catch (error) { setMessage(error.message); }
  }

  async function operate() {
    const request = confirmation;
    const current = entities[request?.entityId];
    const action = controlFor(current, request?.target);
    if (!action || !connected || !connection.current) { setMessage('This device is no longer available. Reconnect and try again.'); setConfirmation(null); return; }
    if (shouldSimulateWrites()) { setConfirmation(null); setMessage('Training preview: no device command sent.'); return; }
    setBusy(true);
    try {
      await callService(connection.current, action.domain, action.service, {}, action.target);
      setConfirmation(null); setMessage('Command accepted. The live device state will confirm the result.');
    } catch (error) { setMessage(error?.message || 'Home Assistant could not perform the command.'); }
    finally { setBusy(false); }
  }

  const visible = equipment.filter((d) => d.site === site && `${d.name} ${d.category} ${d.maker}`.toLowerCase().includes(query.toLowerCase()));
  const switches = Object.values(entities).filter((e) => controlFor(e, 'on'));
  const consoleUrl = settings.haUrl || PRIVATE_HA;
  const entityIds = (d) => settings.mappings[d.id] ? [settings.mappings[d.id], ...d.entities.filter((id) => id !== settings.mappings[d.id])] : d.entities;

  return <main className={`equipment-center ${shopDisplay ? 'equipment-shop-display' : ''} ${tvMode ? 'equipment-tv-mode' : ''}`}>
    {shopDisplay && <section className="eq-display-bar" aria-label="Equipment display controls"><h1>Equipment {tvMode ? 'TV' : 'Touch'}</h1><Link to="/shop-tv">Production display</Link><button className="eq-button" onClick={() => setTvMode(!tvMode)}>{tvMode ? 'Use touch controls' : 'Use TV view'}</button><button className="eq-button" onClick={() => setKiosk(!kiosk)}>{kiosk ? 'Exit kiosk' : 'Full screen layout'}</button></section>}
    <header className="eq-hero">
      <div><p className="eq-kicker">SKILLED CRAFTING / CONNECTED WORKSHOP</p><h1>Mission control<span>.</span></h1><p>Your machines. Your spaces. One place to connect.</p>
        <div className="eq-hero-actions"><External className="eq-button primary" href={`${consoleUrl}/skilled-crafting/${site}`}>Open Home Assistant</External><Link className="eq-button" to="/material-settings">Machine settings & material recipes</Link><Link className="eq-button" to="/uv-studio">UV Studio</Link><button className="eq-button" onClick={() => setEditing(!editing)}>Connection settings</button></div><p className="eq-remote-help">Away from home or the shop? Connect Tailscale on this device first, then sign in to Home Assistant. On a phone, use the private HTTPS address in your browser or Home Assistant Companion app. No router port forwarding is required.</p>
      </div>
      <div className="eq-network" aria-label="Connection diagram"><div className="eq-network-node">HOME<span>Tailscale client</span></div><div className="eq-network-path"><i />PRIVATE CONNECTION<i /></div><div className="eq-network-node">BUSINESS<span>Pi · Mac · Equipment</span></div><small>Business and home networks are linked privately over Tailscale. Remote devices require their own Tailscale connection.</small></div>
    </header>
    <section className="eq-telemetry" aria-label="Connection status">
      <div><span className={`eq-dot ${connected ? 'good' : ''}`} /><strong>{connected ? (site === 'business' ? 'Live Home Assistant' : 'Business hub connected') : 'Live data not connected'}</strong><small>{lastUpdate ? `Received ${lastUpdate.toLocaleTimeString()}` : 'Connect to see current device states'}</small></div>
      <div><strong>{equipment.filter((d) => d.site === site).length.toString().padStart(2, '0')}</strong><small>Devices in this workspace</small></div>
      <div><strong>{connected && site === 'business' ? switches.length : '—'}</strong><small>Supported live controls</small></div>
      <button className="eq-button primary" disabled={busy || !accountKey} onClick={() => connected ? disconnect() : connect(settings.haUrl)}>{busy ? 'Connecting…' : connected ? 'Disconnect live' : 'Connect live'}</button>
    </section>
    {message && <p className="eq-notice" role="status">{message}</p>}
    {editing && <form className="eq-settings" onSubmit={saveSettings}><h2>Private connection</h2><p>Use the Pi’s private HTTPS address for live data inside this app. Tailscale must be connected. Home Assistant handles sign-in; passwords and access tokens are not saved by this page.</p><label>Home Assistant HTTPS address<input type="url" required value={settings.haUrl} onChange={(e) => setSettings({ ...settings, haUrl: e.target.value })} /></label><p className="eq-muted">Private HTTPS uses your Tailscale network. Sign in to Home Assistant to authorize this app’s live connection.</p><button className="eq-button primary" type="submit">Save preferences</button></form>}
    <nav className="eq-remote" aria-label="Remote access">
      <External href={MAC_DESKTOP}><span className="eq-icon">▣</span><div><strong>Business MacBook</strong><small>Pi-assisted Screen Sharing · Tailscale required</small></div></External>
      <External href={PI_DESKTOP}><span className="eq-icon">⌘</span><div><strong>Pi visual desktop</strong><small>Raspberry Pi Connect · visual desktop verified</small></div></External>
      <External href="ssh://mcdanielm@100.117.18.123"><span className="eq-icon">›_</span><div><strong>Pi terminal</strong><small>Open SSH · Tailscale required</small></div></External>
    </nav>
    <div className="eq-toolbar"><div className="eq-tabs" role="group" aria-label="Location"><button aria-pressed={site === 'business'} onClick={() => setSite('business')}>Business workshop</button><button aria-pressed={site === 'home'} onClick={() => setSite('home')}>Home</button></div><label><span className="sr-only">Find equipment</span><input type="search" placeholder="Find equipment…" value={query} onChange={(e) => setQuery(e.target.value)} /></label></div>
    {site === 'home' && <p className="eq-notice">Home devices are displayed according to recorded equipment mappings. Verify the device location and live sensor state before relying on it. Home NAS health monitoring is still pending.</p>}
    <section className="eq-grid" aria-label="Equipment">
      {visible.map((d) => { const mainEntity = connected ? entities[entityIds(d)[0]] : null; const state = entityPresentation(mainEntity); const cameras = connected ? (d.cameraEntities || []).map((id) => entities[id]).filter(Boolean) : []; return <article className={`eq-card eq-${d.id}`} key={d.id}>
        <div className="eq-card-meta"><span>{d.category}</span><span className={`eq-status ${mainEntity ? state.kind : 'pending'}`}><i />{mainEntity ? (d.id === 'pi' ? 'Backup recorded' : state.label) : d.stage}</span></div>
        {cameras.length ? <CameraPreviews cameraEntities={cameras} baseUrl={consoleUrl} refresh={cameraRefresh} name={d.name} category={d.category} /> : <div className={`eq-photo ${d.image || settings.photos[d.id] ? '' : 'eq-no-photo'}`}>{d.image || settings.photos[d.id] ? <img src={settings.photos[d.id] || `/equipment/${d.image}`} alt={`${d.name} product photograph`} loading="lazy" onError={(e) => { e.currentTarget.hidden = true; }} /> : <span aria-hidden="true">{d.cameraEntities?.length ? (connected ? "Camera unavailable" : "Connect live to view camera") : "◈"}</span>}<span className="eq-grid-mark" aria-hidden="true">+</span></div>}
        <div className="eq-card-body"><span className="eq-maker">{d.maker}</span><h2>{d.name}</h2><p>{d.detail}</p>
          {d.id === 'pi' && mainEntity && <div className="eq-reading"><span>Latest successful backup</span><strong>{new Date(mainEntity.state).toLocaleString()}</strong></div>}
          {connected && entityIds(d).slice(1).map((id) => entities[id] && <div className={`eq-reading ${entityPresentation(entities[id]).kind === 'warn' ? 'eq-reading-warning' : ''}`} key={id}><span>{entities[id].attributes.friendly_name}</span><strong>{entityPresentation(entities[id]).label}</strong></div>)}
          <div className="eq-card-actions"><External className="eq-text-link" href={d.haPath ? `${consoleUrl}${d.haPath}` : d.url || `${consoleUrl}/config/integrations`}>{d.action || 'Home Assistant'}</External><button onClick={() => setSelected(d)} aria-label={`Configure ${d.name}`}>Details</button></div>
        </div></article>; })}
    </section>
    {!visible.length && <p className="eq-notice">No matching equipment. Try another name or location.</p>}
    {connected && site === 'business' && !tvMode && <section className="eq-live-controls"><div><p className="eq-kicker">LIVE FROM HOME ASSISTANT</p><h2>Supported controls</h2><p>Verify each device’s name and connected load before operating it.</p></div>{switches.length ? <div className="eq-control-grid">{switches.map((e) => <div key={e.entity_id}><strong>{e.attributes.friendly_name || e.entity_id}</strong><span>{e.state}</span><button className="eq-button" disabled={busy} onClick={() => setConfirmation({ entityId: e.entity_id, name: e.attributes.friendly_name || e.entity_id, target: e.state === 'on' ? 'off' : 'on' })}>Turn {e.state === 'on' ? 'off' : 'on'}…</button></div>)}</div> : <p>No supported switches, lights or fans are currently available.</p>}</section>}
    <footer className="eq-footer">MIDNIGHT INDUSTRIAL <span>•</span> Product photos are reference images. Connection labels are setup records until live data is connected. Laser operation remains in xTool Studio with an operator present.</footer>
    {selected && <div className="eq-modal-backdrop"><section className="eq-modal" role="dialog" aria-modal="true" aria-label={`${selected.name} details`}><button className="eq-close" autoFocus onClick={() => setSelected(null)} aria-label="Close details">×</button><p className="eq-kicker">{selected.site.toUpperCase()} / {selected.category.toUpperCase()}</p><h2>{selected.name}</h2><p>{selected.detail}</p>{selected.address && <p>Address: <code>{selected.address}</code>{selected.site === 'business' && !selected.address.startsWith('100.') && ' · Business LAN only'}</p>}<form onSubmit={(e) => { e.preventDefault(); if (accountKey) localStorage.setItem(accountKey, JSON.stringify(settings)); setSelected(null); }}><label>Photo URL (optional)<input type="url" pattern="https://.+" placeholder="https://…" value={settings.photos[selected.id] || ''} onChange={(e) => setSettings({ ...settings, photos: { ...settings.photos, [selected.id]: e.target.value } })} /></label><label>Primary Home Assistant entity (optional)<input pattern="[a-z_]+\.[a-z0-9_]+" placeholder="sensor.device_status" value={settings.mappings[selected.id] || ''} onChange={(e) => setSettings({ ...settings, mappings: { ...settings.mappings, [selected.id]: e.target.value } })} /></label><small>Saved for your account on this browser. Photos should use HTTPS.</small><button className="eq-button primary" type="submit">Save details</button></form></section></div>}
    {confirmation && <div className="eq-modal-backdrop"><section className="eq-modal" role="dialog" aria-modal="true" aria-label="Confirm device operation"><h2>Turn {confirmation.target} {confirmation.name}?</h2><p>This operates the connected equipment through Home Assistant. Confirm that its connected load is safe to switch.</p><div className="eq-hero-actions"><button autoFocus className="eq-button" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button><button className="eq-button primary" disabled={busy} onClick={operate}>{busy ? 'Sending…' : `Turn ${confirmation.target}`}</button></div></section></div>}
  </main>;
}
