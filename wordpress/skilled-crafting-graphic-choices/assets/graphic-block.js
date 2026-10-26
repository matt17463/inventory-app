/* Scoped, opt-in simple-product Store API chooser for a Woo Blocks product template.
 * Do not install/activate before end-to-end Store API smoke tests. */
(function(){
  'use strict';
  document.querySelectorAll('[data-sc-graphic-block]').forEach(function(root){
    const select=root.querySelector('[data-sc-graphic-choice]');
    const button=root.querySelector('[data-sc-graphic-submit]');
    const msg=root.querySelector('[data-sc-graphic-message]');
    if(!select||!button||!msg)return;
    button.addEventListener('click',async function(){
      if(!select.value){msg.textContent='Choose a graphic design first.';select.focus();return;}
      const product=Number(root.dataset.productId);
      if(!Number.isSafeInteger(product)||product<1){msg.textContent='Product configuration unavailable.';return;}
      const nonce=root.dataset.storeNonce;
      if(!nonce){msg.textContent='Cart security token unavailable. Reload the page.';return;}
      button.disabled=true;
      msg.textContent='Adding selected design to cart…';
      try{
        const response=await fetch(root.dataset.apiUrl,{
          method:'POST',credentials:'same-origin',
          headers:{'Content-Type':'application/json','Nonce':nonce},
          body:JSON.stringify({id:product,quantity:1,sc_graphic_family_id:select.value})
        });
        const data=await response.json();
        if(!response.ok)throw Error(data?.message||'Unable to add design to cart.');
        // Dispatch the supported Woo Blocks cart refresh event after Store API success.
        document.body.dispatchEvent(new CustomEvent('wc-blocks_added_to_cart',{bubbles:true,detail:{preserveCartData:false}}));
        msg.textContent='Selected design added to cart.';
      }catch(error){msg.textContent=error.message||'The selected design could not be added.';}
      finally{button.disabled=false;}
    });
  });
})();
