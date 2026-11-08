# School brochure and client catalog PDF tools

Open **Marketing → Marketing Document Builder**. Select **School spirit-wear brochure** or **Client product catalog**.

## School spirit-wear brochure

1. Choose the school or prospect. The business logo is loaded from `/skilled-crafting-logo.png`; replace it if needed.
2. Enter the business phone, email, website, and optional address. Verify these before sending.
3. Upload a transparent school logo, or use the client logo selected in the builder.
4. Upload a **licensed** blank tee and hoodie photograph. Adjust the logo position and width; choose **Render exact-artwork mockup** for each garment.
5. Enter **agreed decorated wholesale** and **customer retail** prices. The displayed school/club proceeds are retail minus wholesale. These values are not internal supplier purchase costs.
6. Download the one-page PDF. Check the visual fit, legibility, actual logo, and price/terms with the customer.

The brochure explains the wholesale-to-retail arrangement and asks for written confirmation of order collection, taxes, refunds, delivery, and payout details. No terms or prices are assumed to be pre-approved.

## Client product catalog

1. Choose **Client product catalog** and the client organization.
2. Select items through the existing supplier comparison picker or add products manually. Verify the SKU, sizes, and colors.
3. Upload a licensed blank photo for each product and render its mockup using the exact client logo.
4. Add up to seven quantity tiers per item. Each tier specifies minimum quantity, decorated wholesale price, and customer retail price.
5. Export the multi-page PDF, with two products per letter-size page and pricing matrices showing the school/club difference.

The catalog is a client proposal, **not** a purchase order, an inventory reservation, or a production-ready artwork proof. It does not update QuickBooks, WooCommerce, inventory, or travelers.

## Troubleshooting and limitations

- Missing mockup: upload a licensed blank product image and a client logo, then click **Render exact-artwork mockup** again after changing placement.
- Invalid prices: every tier needs positive whole minimum quantity, nonnegative wholesale and retail amounts, and retail no lower than wholesale.
- Missing brand information: enter at least a business phone or email and a website; upload a business logo if the site logo did not load.
- This browser-side editor creates local PDF downloads. It does **not** automatically save composite images or the PDF to Supabase or R2, or issue client approval links.
- Perspective, fabric folds, true garment color, dimensions, and final decoration specifications are not simulated. Confirm a production proof in Mockup Studio before manufacturing.
- Before using the output commercially, verify a real sample PDF on the target browser and printer.
