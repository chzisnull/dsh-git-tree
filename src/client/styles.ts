// Plugin-owned stylesheet. Every colour is a --dsw-alias-* theme token so the
// panel inherits light/dark; the ui-contract test fails if a hardcoded colour
// ever ships.

export const CSS = `
.dgt-root{box-sizing:border-box;height:100%;min-height:0;display:flex;flex-direction:column;
  background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);
  font-family:var(--dsw-font-family);font-size:13px;line-height:20px;
  padding:calc(var(--dsh-frame-top-clearance,0px) + 8px) 12px 12px;}
.dgt-topbar{display:flex;align-items:center;gap:12px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);flex:0 0 auto;}
.dgt-repo{display:flex;flex-direction:column;min-width:0;gap:1px;}
.dgt-repo-name{font-size:14px;font-weight:500;}
.dgt-repo-path{font-size:11px;color:var(--dsw-alias-label-tertiary);max-width:42vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dgt-refs{display:flex;align-items:center;gap:6px;margin-left:auto;min-width:0;}
.dgt-upstream{font-size:11px;color:var(--dsw-alias-label-caption);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:20vw;}
.dgt-branch-glyph{opacity:.75;}
.dgt-chip{display:inline-flex;align-items:center;gap:2px;padding:1px 8px;border-radius:999px;
  background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);
  font-size:11px;line-height:18px;white-space:nowrap;}
.dgt-chip[data-tone='ok']{color:var(--dsw-alias-state-success-primary);}
.dgt-chip[data-tone='warn']{color:var(--dsw-alias-state-warn-primary);}
.dgt-actions{display:flex;align-items:center;gap:8px;}
.dgt-button{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-sm);padding:3px 10px;
  font:inherit;font-size:12px;cursor:pointer;}
.dgt-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);}
.dgt-button:disabled{color:var(--dsw-alias-label-caption);cursor:default;}
.dgt-banner{display:flex;flex-direction:column;gap:2px;margin-top:8px;padding:8px 12px;flex:0 0 auto;
  border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);font-size:12px;}
.dgt-banner strong{color:var(--dsw-alias-state-warn-primary);font-weight:500;}
.dgt-body{display:flex;gap:8px;min-height:0;flex:1 1 auto;margin-top:8px;}
.dgt-rail{flex:0 0 200px;min-width:0;display:flex;flex-direction:column;gap:2px;overflow:auto;
  border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-1);padding:8px;}
.dgt-list{flex:1 1 300px;min-width:0;display:flex;flex-direction:column;
  border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-1);overflow:hidden;}
.dgt-diff{flex:1.4 1 380px;min-width:0;display:flex;flex-direction:column;
  border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-1);overflow:hidden;}
.dgt-list-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:0 0 auto;
  padding:7px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);
  color:var(--dsw-alias-label-secondary);font-size:12px;}
.dgt-count{color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums;}
.dgt-section-title{margin-top:6px;padding:2px 4px;color:var(--dsw-alias-label-tertiary);
  font-size:11px;text-transform:uppercase;letter-spacing:.04em;}
.dgt-placeholder{padding:10px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;}
.dgt-error{color:var(--dsw-alias-state-error-primary);}
.dgt-scroll{overflow:auto;min-height:0;flex:1 1 auto;padding:4px;}
.dgt-group{padding:6px 6px 2px;color:var(--dsw-alias-label-caption);font-size:11px;text-transform:uppercase;letter-spacing:.04em;}
.dgt-file{display:flex;align-items:center;gap:8px;width:100%;text-align:left;appearance:none;border:0;
  background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;
  padding:3px 6px;border-radius:var(--dsw-radius-xs);cursor:pointer;}
.dgt-file:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dgt-file[data-active]{background:var(--dsw-alias-interactive-bg-active);}
.dgt-file-code{flex:0 0 auto;width:18px;text-align:center;font-family:var(--ds-font-family-code);
  font-size:11px;color:var(--dsw-alias-label-tertiary);}
.dgt-file-code[data-status='A']{color:var(--dsw-alias-state-success-primary);}
.dgt-file-code[data-status='D']{color:var(--dsw-alias-state-error-primary);}
.dgt-file-code[data-status='M']{color:var(--dsw-alias-state-warn-primary);}
.dgt-file-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left;}
.dgt-diff-body{min-height:0;flex:1 1 auto;overflow:auto;}
.dgt-premain{margin:0;padding:10px;font-family:var(--ds-font-family-code);
  font-size:var(--dsh-code-font-size,11px);line-height:17px;color:var(--dsw-alias-label-secondary);
  white-space:pre;tab-size:2;}
.dgt-mono{font-family:var(--ds-font-family-code);font-size:11px;color:var(--dsw-alias-label-caption);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%;}
.dgt-spinner{width:12px;height:12px;border-radius:50%;flex:0 0 auto;
  border:1.5px solid var(--dsw-alias-border-l3);border-top-color:var(--dsw-alias-brand-primary);
  animation:dgt-spin .8s linear infinite;}
@keyframes dgt-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.dgt-spinner{animation:none}}
`
