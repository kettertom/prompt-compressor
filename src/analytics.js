/**
 * analytics.js
 * Thin wrapper around gtag for GA4 event tracking.
 * Silently no-ops if gtag is not loaded (dev environment).
 */

function track(eventName, params = {}) {
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
    }
  } catch (e) {
    // never break the app over analytics
  }
}

export const trackTabSwitch       = (tabName)                  => track("tab_switch",            { tab_name: tabName });
export const trackCopy            = (before, after)            => track("copy_output",           { tokens_before: before, tokens_after: after, tokens_saved: before - after, reduction_pct: before > 0 ? Math.round(((before - after) / before) * 100) : 0 });
export const trackDownload        = (before, after)            => track("download_output",       { tokens_before: before, tokens_after: after, tokens_saved: before - after, reduction_pct: before > 0 ? Math.round(((before - after) / before) * 100) : 0 });
export const trackStepToggle      = (stepKey, enabled)         => track("step_toggle",           { step_key: stepKey, enabled });
export const trackSelectAll       = ()                         => track("select_all_steps");
export const trackClearAll        = ()                         => track("clear_all_steps");
export const trackRiskGroupSelect = (riskLabel, allWereOn)     => track("risk_group_select",     { risk_level: riskLabel, action: allWereOn ? "deselect" : "select" });
export const trackReviewApproveAll= ()                         => track("review_approve_all");
export const trackReviewRejectAll = ()                         => track("review_reject_all");
export const trackReviewToggle    = (wasApproved)              => track("review_change_toggle",  { action: wasApproved ? "reject" : "approve" });
