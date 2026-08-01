import LegacyInventoryCompatibilityNotice from './components/LegacyInventoryCompatibilityNotice';

export default function BinPage() {
  return (
    <LegacyInventoryCompatibilityNotice
      title="Legacy automatic bin assignment disabled"
      description="This old component automatically inserted a product into bin_items. It has been disabled so inventory quantities continue to come only from blank_inventory_movements."
    />
  );
}
