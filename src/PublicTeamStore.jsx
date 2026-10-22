import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import './PublicTeamStore.css';

const money=(n)=>Number(n).toLocaleString('en-US',{style:'currency',currency:'USD'});
export default function PublicTeamStore(){
  const {slug}=useParams();
  const [payload,setPayload]=useState(null);
  const [message,setMessage]=useState('Loading the team store…');
  useEffect(()=>{
    let live=true;
    setMessage('Loading the team store…');
    fetch('/.netlify/functions/team-store-public?slug='+encodeURIComponent(slug),{cache:'no-store'})
      .then(async response=>{
        const data=await response.json().catch(()=>({}));
        if(!response.ok||!data.success)throw Error(data.error||'Store unavailable');
        return data;
      }).then(data=>{if(live){setPayload(data);setMessage('');}})
      .catch(e=>{if(live)setMessage(e.message||'This team store is unavailable.');});
    return()=>{live=false;};
  },[slug]);
  const store=payload?.store;
  return <main className="sc-public-team">
    <header className="sc-public-team-header"><div className="sc-public-team-wrap">
      <img src="/skilled-crafting-logo.png" alt="Skilled Crafting" />
      <span>Skilled Crafting · Team & Group Stores</span>
    </div></header>
    {!store?<section className="sc-public-team-message"><h1>Team store</h1><p role="status">{message}</p>
      <a href="https://skilledcrafting.com/">Return to Skilled Crafting</a>
    </section>:<>
      <section className="sc-public-team-hero">
        <div className="sc-public-team-wrap">
          <p className="sc-public-team-eyebrow">{store.organization} · {store.kind?.replaceAll('_',' ')}</p>
          <h1>{store.name}</h1>
          {store.description&&<p>{store.description}</p>}
          <div className="sc-public-team-facts">
            <span><strong>Order deadline:</strong> {store.deadline||'See product page'}</span>
            <span><strong>Fulfillment:</strong> {store.fulfillment_method||'Confirm at checkout'}</span>
          </div>
        </div>
      </section>
      <section className="sc-public-team-wrap sc-public-team-catalog">
        <h2>Shop this collection</h2>
        <p>Choose a product to select available sizes, colors and options on the Skilled Crafting WooCommerce shop. Checkout and payment are handled securely there.</p>
        {payload.products?.length?<div className="sc-public-team-grid">
          {payload.products.map(item=><article className="sc-public-team-product" key={item.id}>
            <div className="sc-public-team-image">{item.image_url?<img src={item.image_url} alt={item.name} loading="lazy" />:<span>Custom Team Apparel</span>}</div>
            <div className="sc-public-team-product-text">
              <h3>{item.name}</h3>
              {item.price!==null&&<p className="sc-public-team-price">From {money(item.price)}</p>}
              <a href={item.url} rel="noopener noreferrer" target="_blank">Choose options & checkout <span aria-hidden="true">↗</span></a>
            </div>
          </article>)}
        </div>:<p>No items are currently available for this campaign.</p>}
        <p className="sc-public-team-notice">{payload.price_notice}</p>
      </section>
      <section className="sc-public-team-wrap sc-public-team-footer">
        <h2>Questions about your team store?</h2>
        <p>Choose your item above to continue directly to WooCommerce. Product personalization is available only where explicitly shown on that item's checkout page.</p>
        <p><small>Prices, taxes, shipping and availability are confirmed during WooCommerce checkout. This online store is separate from the one-time group order and QuickBooks invoice process.</small></p>
      </section>
    </>}
  </main>;
}
