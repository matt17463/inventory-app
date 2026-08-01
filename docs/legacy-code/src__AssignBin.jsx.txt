import LegacyInventoryCompatibilityNotice from './components/LegacyInventoryCompatibilityNotice';

export default function AssignBin() {
  return (
    <LegacyInventoryCompatibilityNotice
      title="Legacy bin assignment disabled"
      description="Direct writes to bin_items are no longer used by the active inventory model. Receive or transfer blank inventory through the current movement-ledger workflows instead."
    />
  );
}
