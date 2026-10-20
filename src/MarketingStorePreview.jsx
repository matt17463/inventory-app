import { useState } from "react";
import { escapeGrowthHtml } from "./lib/growthPricing";

/** Concept only: intentionally no checkout or order placement. */
export default function MarketingStorePreview({ organization, logo, products = [], colors = [] }) {
  const [headline,setHeadline]=useState("Your team. Your gear.");
  const [subtitle,setSubtitle]=useState("A personalized storefront concept prepared by Skilled Crafting.");
  const primary=/^#[0-9a-f]{6}$/i.test(colors[0])?colors[0]:"#163d36";
  function exportConcept() {
    const safe=escapeGrowthHtml;
    const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+safe(organization)+' — Store concept</title><style>body{margin:0;font:16px system-ui;color:#111827}header{background:'+primary+';color:white;padding:50px 30px;text-align:center}main{max-width:1100px;margin:auto;padding:32px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:22px}.product{border:1px solid #ddd;border-radius:10px;padding:16px}.placeholder{height:180px;background:#f0f0f0;display:grid;place-items:center}small{color:#666}</style></head><body><header><small style="color:white">DRAFT CONCEPT — NOT A LIVE STORE</small><h1>'+safe(organization)+'</h1><h2>'+safe(headline)+'</h2><p>'+safe(subtitle)+'</p></header><main><h2>Featured products</h2><div class="grid">'+products.map(p=>'<div class="product"><div class="placeholder">Product photo pending license / mockup approval</div><h3>'+safe(p.name||p.description||"Product concept")+'</h3><p>'+safe(p.colors?.join(", ")||"Color options to confirm")+'</p><small>Price and availability subject to approved proposal</small></div>').join("")+'</div><p><small>Concept only. No checkout, live orders or product availability implied.</small></p></main></body></html>';
    const file=new Blob([html],{type:"text/html;charset=utf-8"});const url=URL.createObjectURL(file);
    const a=document.createElement("a");a.href=url;a.download="store-concept.html";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="growth-subcard">
    <h3>Storefront concept preview</h3>
    <p>Non-transactional draft for client review. Actual WooCommerce storefronts and approved product photos are created by the existing store and mockup workflows.</p>
    <div className="growth-grid"><label className="growth-field"><span>Headline</span><input value={headline} onChange={e=>setHeadline(e.target.value)}/></label><label className="growth-field"><span>Introduction</span><input value={subtitle} onChange={e=>setSubtitle(e.target.value)}/></label></div>
    <div style={{background:primary,color:"#fff",padding:24,borderRadius:12,textAlign:"center"}}><small>CONCEPT — NOT LIVE</small><h2>{organization||"Client Store"}</h2>{logo&&<img src={logo} alt="Client logo" style={{maxHeight:110,maxWidth:150,objectFit:"contain"}}/>}<h3>{headline}</h3><p>{subtitle}</p></div>
    <div className="growth-card-grid">{products.length?products.map((p,i)=><article className="growth-subcard" key={i}><strong>{p.name||p.description||"Product"}</strong><p>Mockup pending approval</p><small>Price and sizes must be verified</small></article>):<p>Select products in a product guide to complete this concept.</p>}</div>
    <button type="button" className="sc-btn" onClick={exportConcept}>Download concept HTML</button>
  </section>;
}
