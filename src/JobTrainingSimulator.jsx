import {useState} from 'react';
const examples=[
 {id:'soccer',title:'Fictional soccer sweatshirt order - QuickBooks',customer:'Example U12 Falcons',qty:14,
  steps:[
   ['The coach submits a group order form, no recurring store. What happens next?',[
    'Create a WooCommerce checkout product anyway','Review in Client Orders and prepare the QuickBooks invoice','Deduct 14 blanks from stock immediately'],1,
    'Correct: one-time group requests go through Client Orders and QuickBooks. There is no need to create a WooCommerce checkout.'],
   ['Customer has paid but some youth sizes are not paired. What is the safe next action?',[
    'Manually reduce stock in a random bin','Open Purchasing and correct blank mappings before pulling','Mark the job completed'],1,
    'Correct: missing mappings or supplier stock must be resolved with the authoritative purchasing/reservation workflow.'],
   ['A print-ready image is saved but there is no customer approval record. What now?',[
    'Assume the image is approved','Print it because the due date is close','Review exact mockup/revision and obtain customer approval'],2,
    'Correct: a linked file is not automatically approved.'],
   ['What should be checked before handoff?',[
    'Pass the actual QC checklist, verify packing counts and record pickup after collection','Record pickup before checking sizes','Press the garments a second time by default'],0,
    'Correct: official QC, packing verification and true delivery evidence are distinct.'],
  ]},
 {id:'school',title:'Fictional recurring school store - WooCommerce',customer:'Example Woodland School',qty:28,
  steps:[
   ['This school expects year-round repeat orders. Choose the order channel.',[
    'Client Stores on WordPress with WooCommerce checkout','A new QuickBooks invoice for each web cart','A manual supplier order before checkout'],0,
    'Correct: a recurring store uses WordPress landing pages and WooCommerce for customer transactions.'],
   ['New product has no school-specific category. Next?',[
    'Publish the storefront and hope it appears','Assign the item to the correct Woo client category and verify it','Turn off category filtering'],1,
    'Correct: category isolation protects the storefront collection.'],
   ['A customer checks out online. How does the order reach production?',[
    'Recreate the same order manually in Client Orders','Use existing Woo order sync and verify the resulting production job','Prepare a QuickBooks invoice before doing anything else'],1,
    'Correct: do not generate duplicate manual orders for Woo purchases.'],
   ['Fundraiser dashboard shows tentative $50 after an ambiguous refund. Next?',[
    'Pay $50 immediately','Ignore refunds','Reconcile Woo/QuickBooks and resolve refund ambiguity before payout'],2,
    'Correct: estimated fundraising earnings are not a settled payout ledger.'],
  ]},
 {id:'manufacture',title:'Fictional DTF hoodie job - production',customer:'Example Panthers Club',qty:6,
  steps:[
   ['Customer supplied an AI-generated graphic with white text. What is important during preflight?',[
    'Remove all white pixels','Keep approved white design and clean only unwanted background/halos','Change DPI metadata and assume all detail is restored'],1,
    'Correct: preserve intended design content; metadata-only DPI changes cannot recreate detail.'],
   ['A helper is unsure where to center the graphic on a youth hoodie. Next?',[
    'Guess by eye','Use measured placement guide from the approved recipe/traveler','Center relative to the hood instead of the garment'],1,
    'Correct: reference garment-specific approved placement and physically verify.'],
   ['One hoodie was scorched. What do you do?',[
    'Hide the item in the bag','Record spoilage and produce a verified replacement','Edit Woo quantities to erase the loss'],1,
    'Correct: failures must be traceable; do not change inventory to conceal waste.'],
   ['The package has been folded but not picked up. What status can be truthfully recorded?',[
    'Picked up by customer','Packing verified','Delivered and completed'],1,
    'Correct: packing and real customer handoff are separate events.'],
  ]},
];
export default function JobTrainingSimulator(){
 const [scenario,setScenario]=useState('soccer');
 const [step,setStep]=useState(0);
 const [choice,setChoice]=useState(-1);
 const [confirmed,setConfirmed]=useState([]);
 const caseItem=examples.find(x=>x.id===scenario)||examples[0];
 const active=caseItem.steps[step],right=choice===active[2],allDone=confirmed.length===caseItem.steps.length;
 function pickCase(id){setScenario(id);setStep(0);setChoice(-1);setConfirmed([]);}
 function next(){
  if(!right)return;
  const done=Array.from(new Set([...confirmed,step]));setConfirmed(done);
  if(step<caseItem.steps.length-1){setStep(i=>i+1);setChoice(-1);}
 }
 return <section className="sc-pack-section sc-simulated-job">
  <h5>Practice a simulated job - family training</h5>
  <p>These examples are entirely fictional. Answering a question does not touch real inventory, WooCommerce, QuickBooks, artwork, QC, or customer records.</p>
  <label>Choose a training scenario<select value={scenario} onChange={e=>pickCase(e.target.value)}>
   {examples.map(x=><option value={x.id} key={x.id}>{x.title}</option>)}
  </select></label>
  <p className="sc-sim-meta">Customer: {caseItem.customer} · Items: {caseItem.qty} · Step {step+1} / {caseItem.steps.length}</p>
  <strong>{active[0]}</strong>
  <div className="sc-sim-choices">{active[1].map((opt,i)=><label key={opt}>
   <input type="radio" name={'scenario-'+scenario+'-question-'+step} checked={choice===i} onChange={()=>setChoice(i)}/>
   <span>{opt}</span></label>)}</div>
  {choice!==-1&&<p role="status" className={right?'sc-sim-correct':'sc-sim-warning'}>
   {right?active[3]:'That choice could create a duplicate order, inaccurate inventory or unapproved production. Check the authoritative workflow and try again.'}</p>}
  <div className="sc-sim-buttons">
    <button type="button" disabled={step===0} onClick={()=>{setStep(i=>i-1);setChoice(-1);}}>Previous</button>
    {step<caseItem.steps.length-1?<button type="button" disabled={!right} onClick={next}>Next simulated decision →</button>:
    <button type="button" disabled={!right} onClick={()=>{setConfirmed(Array.from(new Set([...confirmed,step])));setChoice(-1);}}>Mark fictional scenario complete</button>}
    <button type="button" onClick={()=>pickCase(scenario)}>Reset exercise</button>
  </div>
  {allDone&&<p className="sc-sim-correct"><strong>Practice completed.</strong> This is not permission to perform live production actions. Have the owner observe the first real task.</p>}
 </section>;
}
