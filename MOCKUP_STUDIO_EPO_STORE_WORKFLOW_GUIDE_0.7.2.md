# Mockup Studio guide: building the EPO product store

This guide uses one customer store containing two WooCommerce variable products:

1. Gildan 18500 Hoodie — Red, Sport Grey, and Black — EPO Logo 1 or EPO Logo Classic — front center at 10 inches.
2. Gildan 6400 Tee — Black and White — EPO Logo Kids or EPO Logo 1 — use the placement and print size approved by the customer.

Mockup Studio creates one WooCommerce product from each Mockup Studio project. Create two projects under the same campaign/store name.

## Before starting

Collect and confirm:

- The three original logo files, preferably transparent PNG or SVG:
  - EPO Logo 1
  - EPO Logo Classic
  - EPO Logo Kids
- The customer-approved garment colors.
- Every size to be offered for each product.
- The selling price for each product. One price is applied to every variation created by that project.
- The WooCommerce category or categories.
- The shipping class, packaged weight, length, width, and height.
- The tee artwork placement and print size, because the example request does not specify them.

In WooCommerce, confirm Brand, Style, Color, and Size exist under **Products > Attributes**, including the exact terms you plan to use. Also confirm the product categories and shipping class already exist. Mockup Studio reads and reuses these records instead of creating near-duplicates.

## Project 1: Gildan 18500 Hoodie

### Phase 1 — Project

1. Open **Artwork > Mockup Studio**.
2. Select **Create a mockup project**.
3. Enter:
   - Project name: `EPO — Gildan 18500 Hoodie`
   - Customer: the EPO customer name
   - Campaign / Store: `EPO Product Store`
   - Output style: `Clean catalog`
4. Create the project.

### Phase 2 — Blank Photos

Add one front-view blank image for each color:

| Asset name | Product type | Color | View |
|---|---|---|---|
| Gildan 18500 Hoodie — Red | Hoodie | Red | Front |
| Gildan 18500 Hoodie — Sport Grey | Hoodie | Sport Grey | Front |
| Gildan 18500 Hoodie — Black | Hoodie | Black | Front |

Use **Search existing blank products** when the correct inventory/catalog record and image already exist. This allows Brand and Style to prefill later. Otherwise, upload the blank photographs and enter the exact WooCommerce color names.

### Phase 3 — Artwork

Add only the two logos offered on this hoodie:

- EPO Logo 1
- EPO Logo Classic

Leave **Do not redraw or alter this logo** selected. Use transparent production artwork whenever possible.

### Phase 4 — Placements

Create the six required Color + Logo placements:

| Blank colors | Logo | Placement | Width |
|---|---|---|---|
| Red, Sport Grey, Black | EPO Logo 1 | Center chest | 10 inches |
| Red, Sport Grey, Black | EPO Logo Classic | Center chest | 10 inches |

Efficient method:

1. Create the Red + EPO Logo 1 placement.
2. Choose `center_chest`, enter a 10-inch print width, and save.
3. Use **Copy to all** to copy that logo placement to the other hoodie colors.
4. Repeat for EPO Logo Classic.
5. Review every color because artwork may require small visual-position adjustments on different source photographs.

### Phase 5 — Generate

For each of the six placements:

1. Use **Exact Clean** for the most reliable logo fidelity.
2. Use **AI Assist** only when extra garment realism is needed; inspect the logo carefully afterward.
3. Generate one approved store image per Color + Logo combination.
4. Select those six outputs using **Select for Store**.

### Phase 6 — Captions

Give each mockup a clear internal/store name, for example:

- EPO 18500 Red — Logo 1
- EPO 18500 Red — Classic
- EPO 18500 Sport Grey — Logo 1
- EPO 18500 Sport Grey — Classic
- EPO 18500 Black — Logo 1
- EPO 18500 Black — Classic

Use captioned output files only when the store image itself should display text underneath. The output name can be used for identification without baking the caption into the image.

### Phase 7 — Approval

1. Internally approve the six final outputs.
2. Create the customer review link.
3. Ask the customer to approve the artwork appearance, colors, placement, and 10-inch size.
4. Do not proceed to publication when any output has requested changes.

### Phase 8 — Pricing

Enter the blank garment cost, decoration cost, labor, and markup. Determine the final hoodie selling price. The WooCommerce phase applies the entered base price to every hoodie variation.

### Phase 9 — WooCommerce

Enter or select:

- Product name: `EPO Gildan 18500 Hoodie`
- Product type: `Variable`
- Woo status: `Draft`
- Brand: `Gildan`
- Style: the exact existing WooCommerce term for `18500`
- Base price: the approved hoodie selling price
- Base SKU: your preferred parent SKU, such as `EPO-G18500-HOODIE`
- Colors: `Red, Sport Grey, Black`
- Sizes: every size the customer approved
- Logo choices: `EPO Logo 1` and `EPO Logo Classic`
- Categories: select the EPO store/category and any apparel/hoodie categories required
- Shipping class: select the correct existing shipping class
- Weight and dimensions: enter the packaged product values using the units configured in WooCommerce

In **Variation mockup mapping**, assign:

| Color | Logo selection | Image |
|---|---|---|
| Red | EPO Logo 1 | EPO 18500 Red — Logo 1 |
| Red | EPO Logo Classic | EPO 18500 Red — Classic |
| Sport Grey | EPO Logo 1 | EPO 18500 Sport Grey — Logo 1 |
| Sport Grey | EPO Logo Classic | EPO 18500 Sport Grey — Classic |
| Black | EPO Logo 1 | EPO 18500 Black — Logo 1 |
| Black | EPO Logo Classic | EPO 18500 Black — Classic |

Under **Main product image and gallery**, choose the strongest general image as the main image. All six selected outputs are sent to the product gallery.

The planned variation count is:

`3 colors × number of sizes × 2 logos`

Create the WooCommerce draft.

## Project 2: Gildan 6400 Tee

Create a second project named `EPO — Gildan 6400 Tee`, using the same campaign/store name.

Repeat the phases with:

- Blank colors: Black and White
- Artwork: EPO Logo Kids and EPO Logo 1
- Placement: the customer-approved tee location and print size
- WooCommerce Brand: Gildan
- WooCommerce Style: the exact existing term used for this garment
- Product name: `EPO Gildan 6400 Tee`

Generate and select four mockups:

| Color | Logo selection |
|---|---|
| Black | EPO Logo Kids |
| Black | EPO Logo 1 |
| White | EPO Logo Kids |
| White | EPO Logo 1 |

Map those four combinations in Phase 9. The planned variation count is:

`2 colors × number of sizes × 2 logos`

Create this product as a WooCommerce draft as well.

## WooCommerce verification before publishing

Open each draft in WooCommerce and confirm:

- Product name is correct.
- Status is Draft.
- Brand and Style are assigned.
- Price is correct on every variation.
- Categories are correct.
- The selected main product image appears first.
- All selected mockups appear in the product gallery.
- Every Color + Size + Logo Selection variation exists.
- Every variation has a unique SKU.
- Variation images match the selected Color and Logo.
- Shipping class, weight, and dimensions are correct.
- The product page selections work in a private preview.

WooCommerce supports product weight, dimensions, and shipping class through its product REST API, which Mockup Studio v0.7.2 now supplies. See the official [WooCommerce Products API](https://developer.woocommerce.com/docs/apis/rest-api/v3/products/) and [Product Shipping Classes API](https://developer.woocommerce.com/docs/apis/rest-api/v3/product-shipping-classes/).

Publish only after both the application preview and WooCommerce draft have been checked.

## Production handoff

After approval and store verification:

1. Open Phase 10, Production.
2. Open the Production Packet.
3. Confirm the correct logo, placement, and physical print width for every garment.
4. Save or print the packet.
5. Mark the project Production Ready.

The customer’s selected Logo Selection is retained on the WooCommerce order line so the existing order workflow can identify the requested artwork for the pull sheet and production process.
