/**
 * Shared inline form styles (themed via the CSS vars in app/layout.jsx).
 * Previously copy-pasted into each page.
 */

export const sansFamily = "'DM Sans', sans-serif";
export const serifFamily = "'Lora', serif";

/** Full-width input used on the auth pages (login, register). */
export const inputStyle = {
  padding: "10px 12px",
  border: "1px solid var(--color-border-faint)",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: sansFamily,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  background: "var(--color-input-bg)",
  color: "var(--color-input-text)",
};

/** Slightly tighter input used on settings pages (tank settings, account). */
export const settingsInputStyle = {
  padding: "9px 12px",
  border: "1px solid var(--color-border)",
  borderRadius: "6px",
  fontSize: "14px",
  background: "var(--color-input-bg)",
  color: "var(--color-input-text)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: sansFamily,
};

/** Dark primary button used on the auth pages. */
export const btnStyle = {
  padding: "11px 16px",
  background: "var(--color-btn-dark-bg)",
  color: "var(--color-btn-dark-text)",
  border: "none",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: sansFamily,
  cursor: "pointer",
  fontWeight: 500,
};

/** Accent "Save" button used on settings pages. */
export const accentBtnStyle = {
  padding: "9px 20px",
  background: "var(--color-accent)",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: sansFamily,
};

/** Outlined red button for destructive actions. */
export const dangerBtnStyle = {
  fontSize: "13px",
  color: "var(--color-danger-btn-text)",
  background: "none",
  border: "1px solid var(--color-danger-btn-border)",
  borderRadius: "6px",
  padding: "8px 16px",
  cursor: "pointer",
  fontFamily: sansFamily,
};
