import type { StyleTokens } from "./profiles";

const TOKEN_CSS_VAR_MAP: Record<keyof StyleTokens, string> = {
  panelBg: "--theme-panel-bg",
  panelBorder: "--theme-panel-border",
  titleText: "--theme-title-text",
  bodyText: "--theme-body-text",
  mutedText: "--theme-muted-text",
  menuText: "--theme-menu-text",
  menuBorder: "--theme-menu-border",
  menuBg: "--theme-menu-bg",
  toastBg: "--theme-toast-bg",
  toastBorder: "--theme-toast-border",
  toastText: "--theme-toast-text",
  footerBg: "--theme-footer-bg",
  footerBorder: "--theme-footer-border",
  expTrackBg: "--theme-exp-track-bg",
  expFillFrom: "--theme-exp-fill-from",
  expFillTo: "--theme-exp-fill-to",
  mpTrackBg: "--theme-mp-track-bg",
  mpFillFrom: "--theme-mp-fill-from",
  mpFillTo: "--theme-mp-fill-to",
};

export const applyStyleTokensToRoot = (tokens: StyleTokens) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  (Object.keys(TOKEN_CSS_VAR_MAP) as Array<keyof StyleTokens>).forEach((tokenKey) => {
    root.style.setProperty(TOKEN_CSS_VAR_MAP[tokenKey], tokens[tokenKey]);
  });
};
