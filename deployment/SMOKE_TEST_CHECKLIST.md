# Post-deployment smoke-test checklist

- [ ] Netlify deploy is Published.
- [ ] Inventory Overview loads current quantities.
- [ ] Pull Sheets loads existing orders.
- [ ] Bins loads current storage locations.
- [ ] Customer Portal Preview works in sample mode.
- [ ] A known customer portal token works without employee login.
- [ ] A fake route shows Not Found.
- [ ] `/create-product` redirects to `/inventory/edit-blanks`.
- [ ] Deployment Health standard check passes.
- [ ] Deployment Health deep WooCommerce check passes.
- [ ] WooCommerce webhook delivery receives HTTP 2xx.
- [ ] Manual pull-sheet rerun creates no duplicate job or item.
- [ ] Supplier sync starts and records a run ID.
- [ ] Final read-only SQL audit contains no STOP rows.
