
import React, { useEffect, useMemo, useState } from "react";
import {
  completePullSheetItemDeductBlankSafe,
  getBlankSourceBins,
} from "../lib/pullSheetCompletionApi";

function pickBlankId(item) {
  return (
    item?.blank_product_id ||
    item?.app_paired_blank_product_id ||
    item?.paired_blank_product_id ||
    item?.matched_blank_product_id ||
    item?.blank_id ||
    ""
  );
}

function pickJobItemId(item) {
  return item?.job_item_id || item?.id || "";
}

function pickQuantity(item) {
  return Number(item?.quantity || item?.qty || item?.ordered_quantity || 1);
}

export default function PullSheetCompleteDeductControls({ item, onCompleted }) {
  const jobItemId = pickJobItemId(item);
  const blankId = pickBlankId(item);
  const quantity = pickQuantity(item);

  const [bins, setBins] = useState([]);
  const [binId, setBinId] = useState("");
  const [loadingBins, setLoadingBins] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadBins() {
      if (!blankId) {
        setBins([]);
        return;
      }

      setLoadingBins(true);
      setMessage("");

      try {
        const rows = await getBlankSourceBins(blankId);
        if (!active) return;
        setBins(rows);
        if (rows.length === 1) setBinId(rows[0].bin_id);
      } catch (err) {
        if (!active) return;
        setMessage(`Could not load source bins: ${err.message}`);
      } finally {
        if (active) setLoadingBins(false);
      }
    }

    loadBins();

    return () => {
      active = false;
    };
  }, [blankId]);

  const canComplete = useMemo(() => {
    return Boolean(jobItemId && blankId && quantity > 0 && !saving);
  }, [jobItemId, blankId, quantity, saving]);

  async function handleComplete() {
    setSaving(true);
    setMessage("");

    try {
      const result = await completePullSheetItemDeductBlankSafe({
        jobItemId,
        blankProductId: blankId,
        binId,
        quantity,
        notes: "Completed from pull sheet screen.",
      });

      if (!result?.success) {
        setMessage(result?.message || "Could not complete and deduct blank.");
        return;
      }

      setMessage(result.message || "Completed and deducted.");
      if (typeof onCompleted === "function") await onCompleted(result);
    } catch (err) {
      setMessage(err.message || "Could not complete and deduct blank.");
    } finally {
      setSaving(false);
    }
  }

  if (!blankId) {
    return (
      <div className="sc-inline-warning">
        Pair a blank product before completing this line.
      </div>
    );
  }

  return (
    <div className="sc-pullsheet-complete-panel">
      <label className="sc-field-label">Blank Source Bin</label>
      <select
        value={binId}
        onChange={(event) => setBinId(event.target.value)}
        disabled={loadingBins || saving}
      >
        <option value="">
          {loadingBins ? "Loading bins..." : "Auto-pull from available bins"}
        </option>
        {bins.map((bin) => (
          <option key={bin.bin_id} value={bin.bin_id}>
            {bin.display_name || `${bin.bin_code || bin.bin_id} · Qty ${bin.available_quantity}`}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="btn btn-primary sc-complete-deduct-button"
        onClick={handleComplete}
        disabled={!canComplete}
      >
        {saving ? "Completing..." : "Complete + Deduct Blank"}
      </button>

      {message ? <div className="sc-action-message">{message}</div> : null}
    </div>
  );
}
