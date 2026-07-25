import LegacyInventoryCompatibilityNotice from './components/LegacyInventoryCompatibilityNotice';

export default function SelectProduct() {
  return (
    <LegacyInventoryCompatibilityNotice
      title="Legacy product selection disabled"
      description="This older selector led to direct bin_items assignments. Use the current blank receiving, transfer, and inventory pages so every quantity change is recorded in blank_inventory_movements."
    />
  );
}
