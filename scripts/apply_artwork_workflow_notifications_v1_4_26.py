#!/usr/bin/env python3
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
home = root / 'src' / 'Home.jsx'
pkg = root / 'package.json'
if not home.exists() or not pkg.exists():
    raise SystemExit('STOP: Run this from the inventory-app repository (src/Home.jsx and package.json are required).')

text = home.read_text()
if 'sc-artwork-activity-seen-at' in text:
    print('Home artwork notifications already installed.')
else:
    anchor = "const number = (value) => new Intl.NumberFormat('en-US').format(Number(value || 0));\n"
    insert = anchor + "\nconst artworkEventLabels = {\n  artwork_request_created: 'New artwork request',\n  artwork_request_updated: 'Artwork request updated',\n  artwork_status_changed: 'Artwork status changed',\n  artwork_mockup_uploaded: 'Mockup uploaded',\n  artwork_mockup_updated: 'Mockup details updated',\n  artwork_mockup_replaced: 'Mockup replaced',\n  artwork_mockup_deleted: 'Mockup deleted',\n  artwork_changes_requested: 'Artwork changes requested',\n  artwork_approved: 'Artwork approved',\n  approved_artwork: 'Artwork approved',\n  artwork_saved_to_vault: 'Artwork saved to vault',\n};\n\nfunction artworkActivityLabel(row) {\n  return artworkEventLabels[row?.event_type] || String(row?.event_type || 'Artwork activity').replace(/_/g, ' ');\n}\n"
    if anchor not in text:
        raise SystemExit('STOP: Home.jsx number formatter anchor was not found; no files changed.')
    text = text.replace(anchor, insert, 1)

    anchor = "  const [error, setError] = useState('');\n"
    insert = anchor + "  const [artworkActivity, setArtworkActivity] = useState([]);\n  const [artworkSeenAt, setArtworkSeenAt] = useState('');\n"
    if anchor not in text:
        raise SystemExit('STOP: Home.jsx state anchor was not found; no files changed.')
    text = text.replace(anchor, insert, 1)

    old = """  async function loadStats() {\n    setLoading(true);\n    setError('');\n    const { data, error } = await supabase.rpc('sc_home_dashboard_stats');\n    if (error) {\n      setError(error.message);\n      setStats({});\n    } else {\n      setStats(data || {});\n    }\n    setLoading(false);\n  }\n\n  useEffect(() => { loadStats(); }, []);\n"""
    new = """  async function loadStats() {\n    setLoading(true);\n    setError('');\n    const [statsResult, activityResult] = await Promise.all([\n      supabase.rpc('sc_home_dashboard_stats'),\n      supabase\n        .from('sc_artwork_system_handoffs')\n        .select('id,event_type,source_type,source_id,received_at,payload')\n        .eq('source_type', 'request')\n        .order('received_at', { ascending: false })\n        .limit(8),\n    ]);\n\n    if (statsResult.error) {\n      setError(statsResult.error.message);\n      setStats({});\n    } else {\n      setStats(statsResult.data || {});\n    }\n\n    if (activityResult.error) {\n      setError((current) => current || `Artwork activity could not load: ${activityResult.error.message}`);\n      setArtworkActivity([]);\n    } else {\n      setArtworkActivity(activityResult.data || []);\n    }\n    setLoading(false);\n  }\n\n  useEffect(() => {\n    try { setArtworkSeenAt(window.localStorage.getItem('sc-artwork-activity-seen-at') || ''); } catch (_) { /* local storage is optional */ }\n    loadStats();\n  }, []);\n\n  const unreadArtworkActivity = artworkActivity.filter((row) => !artworkSeenAt || new Date(row.received_at).getTime() > new Date(artworkSeenAt).getTime()).length;\n\n  function markArtworkActivityViewed() {\n    const newest = artworkActivity[0]?.received_at || new Date().toISOString();\n    setArtworkSeenAt(newest);\n    try { window.localStorage.setItem('sc-artwork-activity-seen-at', newest); } catch (_) { /* local storage is optional */ }\n  }\n"""
    if old not in text:
        raise SystemExit('STOP: Home.jsx loadStats block was not found; no files changed.')
    text = text.replace(old, new, 1)

    anchor = """      <section className=\"sc-stat-grid sc-stat-grid-home\">\n"""
    panel = """      {artworkActivity.length > 0 && (\n        <section className=\"sc-panel sc-panel-color-left\">\n          <div className=\"sc-panel-header\">\n            <div>\n              <div className=\"sc-kicker\">Artwork Notifications</div>\n              <h3>{unreadArtworkActivity > 0 ? `${unreadArtworkActivity} artwork update${unreadArtworkActivity === 1 ? '' : 's'} need attention` : 'Recent artwork activity'}</h3>\n              <p>New requests and meaningful Artwork System changes appear here as soon as WordPress sends the webhook.</p>\n            </div>\n            <div className=\"sc-hero-actions\">\n              <Link className=\"sc-btn sc-btn-purple\" to=\"/artwork-requests\">Open Artwork Queue</Link>\n              {unreadArtworkActivity > 0 && <button className=\"sc-btn\" type=\"button\" onClick={markArtworkActivityViewed}>Mark viewed</button>}\n            </div>\n          </div>\n          <div className=\"sc-workflow-list sc-workflow-list-colored\">\n            {artworkActivity.slice(0, 5).map((row) => {\n              const request = row.payload?.artwork_request || {};\n              const project = request.organization || request.customer_name || request.project_type || `Artwork request #${row.source_id}`;\n              const isUnread = !artworkSeenAt || new Date(row.received_at).getTime() > new Date(artworkSeenAt).getTime();\n              return (\n                <div key={row.id} style={{ padding: '10px 0' }}>\n                  <strong>{isUnread ? 'NEW · ' : ''}{artworkActivityLabel(row)}</strong>\n                  <span style={{ display: 'block' }}>{project} · WordPress #{row.source_id} · {new Date(row.received_at).toLocaleString()}</span>\n                </div>\n              );\n            })}\n          </div>\n        </section>\n      )}\n\n""" + anchor
    if anchor not in text:
        raise SystemExit('STOP: Home.jsx stat grid anchor was not found; no files changed.')
    text = text.replace(anchor, panel, 1)
    home.write_text(text)
    print('Patched src/Home.jsx with artwork homepage notifications.')

pkg_data = json.loads(pkg.read_text())
if pkg_data.get('version') == '1.4.25':
    pkg_data['version'] = '1.4.26'
else:
    print(f"NOTE: package version is {pkg_data.get('version')}; leaving it unchanged rather than overwriting a newer version.")
scripts = pkg_data.setdefault('scripts', {})
scripts['test:artwork-notifications'] = 'node --test scripts/tests/artwork-home-notifications.test.mjs'
if 'test' in scripts and 'test:artwork-notifications' not in scripts['test']:
    scripts['test'] += ' && npm run test:artwork-notifications'
pkg.write_text(json.dumps(pkg_data, indent=2) + '\n')
print('Updated package.json test coverage/version where applicable.')
