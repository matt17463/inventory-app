import { PI_DESKTOP } from './lib/equipment';

export default function RemoteAccessShortcuts() {
  return <section className="eq-access" aria-labelledby="remote-access-heading">
    <h2 id="remote-access-heading">Remote-access shortcuts</h2>
    <p className="eq-remote-help">Connect Tailscale on this device first. These shortcuts use your existing device accounts; connection checks do not confirm a successful sign-in.</p>
    <div className="eq-access-grid">
      <article className="eq-access-card">
        <h3>Diana’s Windows laptop</h3>
        <p>Screen sharing · VNC over Tailscale</p>
        <code>100.78.205.88:5900</code>
        <a className="eq-button primary" href="vnc://100.78.205.88:5900">Open Diana’s screen sharing</a>
        <details><summary>Connection help</summary><p>On a Mac, this opens Screen Sharing. On Windows, Android or iOS, open your installed VNC viewer and enter the address above. Use the laptop’s existing VNC credentials. Keep the laptop awake and connected to Tailscale. The desktop opens in a separate app.</p><p>VNC responded on October 24, 2026; desktop sign-in still needs verification.</p></details>
      </article>
      <article className="eq-access-card">
        <h3>Business-network NAS</h3>
        <p>Thecus N5500 · business network</p>
        <code>192.168.1.100</code>
        <a className="eq-button" href={PI_DESKTOP} target="_blank" rel="noopener noreferrer">Open business Pi desktop</a>
        <details><summary>Business NAS connection instructions</summary><p>Sign in to Raspberry Pi Connect, then use the Pi’s file manager to connect to <code>smb://192.168.1.100</code>. On a computer at the business, use Finder → Go → Connect to Server with the same address, or Windows File Explorer with <code>{'\\\\192.168.1.100'}</code>. Choose an existing share and sign in with your NAS account.</p><p>A direct NAS connection from another network requires a verified business subnet route. The business Pi currently advertises no business subnet route. Use its desktop when away; a local address alone cannot identify the correct site.</p></details>
      </article>
      <article className="eq-access-card">
        <h3>Home-network NAS</h3>
        <p>Synology SynServer · SMB over Tailscale</p>
        <code>100.76.196.90</code>
        <a className="eq-button" href="smb://100.76.196.90">Open home NAS files</a>
        <details><summary>Home NAS connection instructions</summary><p>On a Mac, choose Finder → Go → Connect to Server and enter <code>smb://100.76.196.90</code>. On Windows, enter <code>{'\\\\100.76.196.90'}</code> in File Explorer. On a phone, use an SMB-capable file app. Select an existing share and use your NAS account. If the browser does not open the file app, enter the address manually.</p><p>SMB responded on October 24, 2026; file sign-in still needs verification. DSM HTTPS on port 5001 currently presents an untrusted certificate. A trusted certificate for its private hostname is needed before adding a management shortcut.</p></details>
      </article>
    </div>
  </section>;
}
