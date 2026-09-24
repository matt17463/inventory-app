import { PageHeader, SectionCard, StatusBadge } from './components/UIPrimitives';

const Step = ({ n, title, children }) => (
  <li style={{ marginBottom: '0.85rem' }}>
    <strong>{n}. {title}</strong>
    <div className="sc-muted" style={{ marginTop: '0.2rem' }}>{children}</div>
  </li>
);

export default function ApplicationGuide() {
  return (
    <main className="sc-page sc-page-stack">
      <PageHeader
        eyebrow="HELP & TRAINING"
        title="Skilled Crafting Application Guide"
        description="Administrative reference and day-to-day workflow guide for inventory, purchasing, production, on-site sales, artwork, and system maintenance."
      />

      <SectionCard title="Daily workflow — the shortest version">
        <ol>
          <Step n="1" title="Receive blank garments">Inventory → Add Item to Bin. Receive manually or import a supplier confirmation. Confirm the destination bin and actual received quantity.</Step>
          <Step n="2" title="Review incoming jobs">Production → Pull Sheets and Order Risk. Confirm due dates, blank pairings, inventory availability, and any Pending Stock items.</Step>
          <Step n="3" title="Purchase shortages">Purchasing → Purchasing Report. Review true shortages, correct a bad pairing before ordering, and exclude non-inventory items.</Step>
          <Step n="4" title="Pull and produce">Open the pull sheet, choose the physical source bin, pull the blank, apply artwork, and use Complete + Deduct when production is finished.</Step>
          <Step n="5" title="Handle finished stock when appropriate">Return a completed item to finished inventory only when it is intentionally being held for later sale or fulfillment.</Step>
        </ol>
      </SectionCard>

      <SectionCard title="Receiving inventory">
        <p><strong>Manual receiving:</strong> Use Inventory → Add Item to Bin. Set receiving defaults, enter size/quantity rows, and choose Receive All Complete Lines.</p>
        <p><strong>Supplier confirmation import:</strong> Upload the supplier PDF or spreadsheet, review yellow/red rows, correct Brand / Style / Color / Size where needed, confirm the bin, then receive selected units.</p>
        <p><strong>Duplicate supplier orders:</strong> A previously imported order may be reopened safely. The screen shows what was already received and permits only remaining quantities.</p>
        <p><strong>Missing blanks:</strong> Keep automatic blank creation enabled only when the supplier row contains enough reliable product identity data. If the match is questionable, correct the attributes before receiving.</p>
      </SectionCard>

      <SectionCard title="Pull sheets and production">
        <p>Pull sheets are the operational bridge between the customer order and physical blank inventory. Opening a pull sheet should not deduct inventory.</p>
        <ul>
          <li><strong>Override Blank Pairing:</strong> Use when the app selected the wrong blank. Search results include the current on-hand inventory quantity.</li>
          <li><strong>Remember mapping:</strong> Leave enabled when the correction should apply to future orders using the same WooCommerce variation/SKU.</li>
          <li><strong>Pending Stock:</strong> Means the item is required but not currently on hand. Receive the item before completing and deducting the line.</li>
          <li><strong>Complete + Deduct:</strong> Use only after the garment has actually been pulled/produced. This reduces physical blank inventory.</li>
          <li><strong>Mark complete only:</strong> Changes job status without changing inventory. Use intentionally.</li>
        </ul>
      </SectionCard>

      <SectionCard title="Purchasing">
        <p>The Purchasing Report should represent inventory that must actually be ordered. Before placing an order:</p>
        <ul>
          <li>Correct any obviously wrong blank pairing.</li>
          <li>Exclude fees, services, customer-supplied items, and other non-inventory lines.</li>
          <li>Confirm shortages assigned to Pending Stock are genuine shortages.</li>
          <li>Use inline pairing repair when the suggested product is not the blank you intend to purchase.</li>
        </ul>
      </SectionCard>

      <SectionCard title="Order priority and due-date risk">
        <p>Production → Order Risk highlights active jobs that need attention because of due dates, shortages, production progress, or open tasks. Closed and completed jobs are excluded from risk consideration.</p>
        <p>Use the risk page as a work queue, not as an order-history page. Historical/completed work belongs in pull-sheet history, activity, and audit views.</p>
      </SectionCard>

      <SectionCard title="On-site sales">
        <p>Use Production → On-site Sales for event sales where blank garments are decorated while the customer waits. Choose the active WooCommerce category, then select only in-stock blank/product options.</p>
        <p><strong>Test Mode</strong> should be used for practice transactions so inventory is not reduced. Confirm the device layout before the event and print a test label before customer traffic begins.</p>
      </SectionCard>

      <SectionCard title="Artwork and Mockup Studio">
        <p>Artwork Requests collects customer requirements and files. Mockup Studio is used to prepare visual mockups, approvals, product images, production dimensions, and the production packet.</p>
        <p>Do not delete source artwork merely because a local copy has been downloaded. Project graphics stored in R2/Supabase are part of the project record.</p>
      </SectionCard>

      <SectionCard title="Administrative maintenance">
        <ul>
          <li><strong>WooCommerce Sync:</strong> Run after catalog/product changes that must be reflected in the application.</li>
          <li><strong>Product-to-Blank Mappings:</strong> Maintain durable Woo variation/SKU → physical blank relationships.</li>
          <li><strong>Color Pairings:</strong> Normalize supplier/manufacturer color names to the canonical WooCommerce color list.</li>
          <li><strong>Product Type Manager:</strong> Maintain Tee, Hoodie, Sweatshirt, Bag, and other type classifications used by On-site Sales and catalog workflows.</li>
          <li><strong>Non-Inventory Rules:</strong> Maintain repeatable rules for fees/services that should not create purchasing demand.</li>
          <li><strong>Operations Integrity / Product Integrity:</strong> Use for duplicate/mapping/reconciliation problems before making manual database changes.</li>
          <li><strong>Deployment Health / Asset Storage Health:</strong> Check after deployments or when WooCommerce, database functions, or artwork storage appear unavailable.</li>
        </ul>
      </SectionCard>

      <SectionCard title="Understanding action status">
        <p>Save/update controls show their processing status next to the action that started the work.</p>
        <p><StatusBadge status="Working" tone="info" /> means the action is still processing. Long-running operations show a real percentage when measurable progress is available.</p>
        <p><StatusBadge status="Completed" tone="success" /> means the action finished successfully. A warning/error notice remains near the relevant item when follow-up is required.</p>
      </SectionCard>

      <SectionCard title="Recommended troubleshooting order">
        <ol>
          <Step n="1" title="Read the status beside the action">Determine whether the request is still working, completed, or needs attention.</Step>
          <Step n="2" title="Refresh the affected page">Confirm the saved state rather than repeating the same operation immediately.</Step>
          <Step n="3" title="Check the integrity/health pages">Use Operations Integrity, Product Integrity, Deployment Health, or Asset Storage Health depending on the symptom.</Step>
          <Step n="4" title="Verify WooCommerce sync">If the problem involves products, variations, colors, sizes, or newly created catalog data, verify the Woo sync.</Step>
          <Step n="5" title="Avoid direct database edits unless necessary">Prefer the application repair tools so reservations, purchasing, mappings, and audit data remain synchronized.</Step>
        </ol>
      </SectionCard>
    </main>
  );
}
