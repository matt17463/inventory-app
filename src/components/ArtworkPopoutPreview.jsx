import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Same-origin, read-only companion window. The editor remains the source of truth.
 * The window uses cloned DOM rather than canvas serialization, so remote artwork
 * does not become a tainted-canvas failure and no image is uploaded.
 */
export default function ArtworkPopoutPreview({ targetRef, rootClass = '', title = 'Artwork proof' }) {
  const popupRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const syncRef = useRef(() => {});
  const close = useCallback(() => {
    const popup = popupRef.current;
    popupRef.current = null;
    if (popup && !popup.closed) popup.close();
    setIsOpen(false);
  }, []);

  useEffect(() => {
    let frame = 0;
    const sync = () => {
      const popup = popupRef.current;
      const target = targetRef.current;
      if (!popup || popup.closed || !target) return;
      const stage = popup.document.getElementById('artwork-popout-stage');
      if (!stage) return;
      const clone = target.cloneNode(true);
      // A cloned element is deliberately inert: React event handlers are not copied.
      clone.querySelectorAll('button,input,select,textarea,a').forEach(element => element.remove());
      stage.replaceChildren(clone);
    };
    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    syncRef.current = schedule;
    const observer = new MutationObserver(schedule);
    if (targetRef.current) observer.observe(targetRef.current, {
      attributes: true, childList: true, characterData: true, subtree: true,
    });
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [targetRef]);

  useEffect(() => () => {
    const popup = popupRef.current;
    popupRef.current = null;
    if (popup && !popup.closed) popup.close();
  }, []);

  const open = () => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus(); syncRef.current(); return;
    }
    const popup = window.open('', '', 'popup=yes,width=960,height=720,resizable=yes,scrollbars=yes');
    if (!popup) { window.alert('The browser blocked the preview window. Allow pop-ups for this application and try again.'); return; }
    popupRef.current = popup;
    const doc = popup.document;
    doc.title = title + ' — Skilled Crafting';
    doc.head.replaceChildren();
    doc.head.appendChild(Object.assign(doc.createElement('meta'), { charset: 'utf-8' }));
    const viewport = doc.createElement('meta');
    viewport.name = 'viewport'; viewport.content = 'width=device-width,initial-scale=1';
    doc.head.appendChild(viewport);
    // Only copy styles from this same-origin application, not data or active scripts.
    document.querySelectorAll('link[rel="stylesheet"],style').forEach(source => {
      doc.head.appendChild(source.cloneNode(true));
    });
    const custom = doc.createElement('style');
    custom.textContent = 'body{margin:0;padding:16px;background:#101b2a;color:#e8f0ff}#artwork-popout-stage{max-width:1100px;margin:0 auto}#artwork-popout-stage img{max-width:100%}#artwork-popout-stage .dtf-canvas{height:min(78vh,720px)}#artwork-popout-stage .mockup-placement-preview{max-height:80vh}header.sc-popout-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;font:600 15px system-ui}header.sc-popout-head button{padding:8px 12px;border:1px solid #5c8798;border-radius:8px;color:#fff;background:#243b50;cursor:pointer}';
    doc.head.appendChild(custom);
    doc.body.replaceChildren();
    const root = doc.createElement('main'); root.className = rootClass;
    const head = doc.createElement('header'); head.className = 'sc-popout-head';
    const heading = doc.createElement('span'); heading.textContent = title + ' · Live, read-only';
    const button = doc.createElement('button'); button.type = 'button'; button.textContent = 'Close preview';
    button.addEventListener('click', close);
    head.append(heading, button);
    const stage = doc.createElement('div'); stage.id = 'artwork-popout-stage';
    root.append(head, stage); doc.body.appendChild(root);
    setIsOpen(true);
    syncRef.current();
    popup.focus();
  };

  return <button type="button" className="artwork-popout-button" aria-label={isOpen ? 'Focus artwork preview window' : 'Pop out artwork preview window'} onClick={open}>
    {isOpen ? '↗ Focus preview window' : '↗ Pop out preview'}
  </button>;
}
