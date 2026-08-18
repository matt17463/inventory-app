# Inventory Overview Search Review — 0.6.27

The prior implementation loaded an app-facing inventory view once and then
filtered a fixed list of explicit fields in the browser. The search could fail
when a product was outside the first response page, when the keyword existed
only in a description, or when it existed in a linked Woo SKU while the
optional checkbox was disabled.

The replacement implementation pages through the complete app-facing relation,
automatically includes linked SKU fields, and supplements each inventory row
with searchable base-catalog metadata. Search remains case-insensitive,
punctuation-insensitive, and supports multiple keywords across different
fields.
