import LegacyInventoryCompatibilityNotice from './components/LegacyInventoryCompatibilityNotice';

export default function CreateProduct() {
  return (
    <LegacyInventoryCompatibilityNotice
      title="Create Product has moved"
      description="The old Create Product screen inserted directly into the WooCommerce product catalog and then used the retired bin_items workflow. It has been disabled to prevent incomplete product mappings or duplicate inventory."
    />
  );
}
