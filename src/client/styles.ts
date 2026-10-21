// Plugin-owned stylesheet.
//
// Structure follows Sourcetree's information architecture: a flat toolbar, a
// reference rail, a change list and a diff pane split by 1px rules, and a
// commit box pinned to the bottom. Every colour is a --dsw-* theme token, so
// light and dark both work without a second design.

export const CSS = `
.dgt-root{position:relative;box-sizing:border-box;height:100%;min-height:0;display:flex;flex-direction:column;
  background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);
  font-family:var(--dsw-font-family);font-size:12.5px;line-height:18px;
  padding:calc(var(--dsh-frame-top-clearance,0px) + 6px) 10px 10px;
  /* readable semantic text: mix the state colour toward the label colour */
  --dgt-ok:color-mix(in srgb, var(--dsw-alias-state-success-primary) 55%, var(--dsw-alias-label-primary));
  --dgt-warn:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 58%, var(--dsw-alias-label-primary));
  --dgt-err:color-mix(in srgb, var(--dsw-alias-state-error-primary) 70%, var(--dsw-alias-label-primary));
  --dgt-meta:var(--dsw-alias-label-secondary);
  --dgt-lane-0:var(--dsw-alias-brand-primary);
  --dgt-lane-1:color-mix(in srgb, var(--dsw-alias-state-success-primary) 65%, var(--dsw-alias-label-primary));
  --dgt-lane-2:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 70%, var(--dsw-alias-label-primary));
  --dgt-lane-3:color-mix(in srgb, var(--dsw-alias-state-error-primary) 70%, var(--dsw-alias-label-primary));
  --dgt-lane-4:color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, var(--dsw-alias-state-success-primary));}

/* toolbar */
.dgt-topbar{display:flex;align-items:center;gap:10px;flex:0 0 auto;height:44px;padding:0 10px;
  border:1px solid var(--dsw-alias-border-l2);border-bottom:0;
  border-radius:var(--dsw-radius-md) var(--dsw-radius-md) 0 0;
  background:var(--dsw-alias-bg-layer-1);}
.dgt-repo{position:relative;display:flex;align-items:baseline;gap:8px;min-width:0;}
.dgt-repo-switch{display:inline-flex;align-items:center;gap:4px;margin-left:-4px;padding:2px 4px;border:0;
  border-radius:var(--dsw-radius-xs);background:transparent;color:var(--dsw-alias-label-primary);
  font:inherit;font-size:13px;font-weight:600;cursor:pointer;max-width:24vw;}
.dgt-repo-switch:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dgt-repo-caret{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1;}
.dgt-repo-menu{position:absolute;left:0;top:calc(100% + 8px);z-index:20;min-width:300px;max-width:440px;
  max-height:320px;overflow:auto;padding:4px;border:1px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-3);
  box-shadow:0 8px 24px var(--dsw-alias-bg-mask-1);}
.dgt-repo-menu-item{display:flex;flex-direction:column;align-items:flex-start;gap:1px;width:100%;
  padding:5px 8px;border:0;border-radius:var(--dsw-radius-xs);background:transparent;
  color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;}
.dgt-repo-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dgt-repo-menu-item[data-current]{background:var(--dsw-alias-interactive-bg-active);}
.dgt-repo-menu-title{font-size:12px;font-weight:500;}
.dgt-repo-menu-path{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--dsw-alias-label-tertiary);font-size:10.5px;direction:rtl;text-align:left;}
.dgt-repo-menu-empty{padding:6px 8px;color:var(--dsw-alias-label-tertiary);font-size:11.5px;}
.dgt-repo-name{font-size:13px;font-weight:600;white-space:nowrap;}
.dgt-repo-path{font-size:11px;color:var(--dsw-alias-label-tertiary);max-width:26vw;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left;}
.dgt-refs{display:flex;align-items:center;gap:6px;margin-left:auto;min-width:0;}
.dgt-chip{display:inline-flex;align-items:center;gap:4px;padding:1px 8px;border-radius:999px;
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);
  font-size:11px;line-height:18px;white-space:nowrap;}
.dgt-chip[data-tone='ok']{color:var(--dsw-alias-state-success-primary);}
.dgt-chip[data-tone='warn']{color:var(--dsw-alias-state-warn-primary);}
.dgt-chip[data-tone='brand']{color:var(--dsw-alias-brand-text);}
.dgt-upstream{font-size:11px;color:var(--dsw-alias-label-caption);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;max-width:18vw;}
.dgt-actions{display:flex;align-items:center;gap:4px;}
.dgt-iconbtn{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:4px;
  width:26px;height:26px;padding:0;border:0;border-radius:var(--dsw-radius-xs);
  background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:11px;}
.dgt-iconbtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);
  color:var(--dsw-alias-label-primary);}
.dgt-iconbtn:disabled{color:var(--dsw-alias-label-caption);cursor:default;}
.dgt-iconbtn[data-busy='true'] svg{animation:dgt-spin .9s linear infinite;}
@keyframes dgt-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.dgt-iconbtn[data-busy='true'] svg{animation:none}}

/* body: rail | (panes + commit box) */
.dgt-body{display:flex;flex:1 1 auto;min-height:0;border:1px solid var(--dsw-alias-border-l2);
  border-radius:0 0 var(--dsw-radius-md) var(--dsw-radius-md);overflow:hidden;
  background:var(--dsw-alias-bg-layer-1);}

/* reference rail */
.dgt-rail{flex:0 0 224px;min-width:0;display:flex;flex-direction:column;overflow:auto;
  padding:4px 0 8px;border-right:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-2);}
.dgt-rail-title{display:flex;align-items:center;justify-content:space-between;height:26px;padding:0 12px;
  margin-top:6px;color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:600;
  letter-spacing:.06em;text-transform:uppercase;}
.dgt-rail-title:first-child{margin-top:0;}
.dgt-rail-row{display:flex;align-items:center;gap:6px;height:26px;padding:0 12px 0 20px;
  color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.dgt-rail-row[data-active='true']{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, var(--dsw-alias-bg-layer-1));
  color:var(--dsw-alias-label-primary);font-weight:600;}
.dgt-rail-row[data-current='true']{color:var(--dsw-alias-label-primary);font-weight:500;}
.dgt-rail-row[data-muted='true']{color:var(--dsw-alias-label-caption);}
.dgt-rail-icon{display:inline-flex;align-items:center;color:var(--dsw-alias-label-tertiary);flex:0 0 auto;}
.dgt-rail-row[data-current='true'] .dgt-rail-icon{color:var(--dsw-alias-brand-text);}
.dgt-rail-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-brand-primary);flex:0 0 auto;}
.dgt-rail-name{overflow:hidden;text-overflow:ellipsis;}
.dgt-rail-empty{padding:4px 12px 6px 20px;color:var(--dsw-alias-label-caption);font-size:11px;}
.dgt-rail-scroll{overflow:hidden;}

/* panes */
.dgt-main{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;min-height:0;}
.dgt-panes{display:flex;flex:1 1 auto;min-height:0;min-width:0;}
.dgt-list{display:flex;flex-direction:column;flex:0 0 360px;min-width:0;min-height:0;
  border-right:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);}
.dgt-diff{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;min-height:0;
  background:var(--dsw-alias-bg-base);}

/* history view */
.dgt-history{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;min-height:0;
  background:var(--dsw-alias-bg-base);}
.dgt-htoolbar{display:flex;align-items:center;gap:8px;flex:0 0 auto;height:32px;padding:0 10px;
  border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);}
.dgt-searchbar{display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;}
.dgt-search-input{flex:1 1 auto;min-width:80px;height:24px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);
  font:inherit;font-size:12px;}
.dgt-search-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary);}
.dgt-search-input::placeholder{color:var(--dsw-alias-label-caption);}
.dgt-search-narrow{flex:0 1 150px;}
.dgt-seg{display:inline-flex;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);
  overflow:hidden;background:var(--dsw-alias-bg-layer-1);}
.dgt-seg-btn{appearance:none;border:0;height:22px;padding:0 10px;background:transparent;
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;}
.dgt-seg-btn:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dgt-seg-btn[data-active]{background:var(--dsw-alias-interactive-bg-active);
  color:var(--dsw-alias-label-primary);font-weight:500;}
.dgt-hhead{display:grid;grid-template-columns:88px minmax(0,1fr) 90px 120px 150px;align-items:center;
  flex:0 0 auto;height:26px;padding:0 10px;border-bottom:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);
  font-size:11px;font-weight:600;}
.dgt-hscroll{flex:1 1 auto;min-height:0;overflow:auto;}
.dgt-hlist{padding:2px 0 8px;}
.dgt-hrow{display:grid;grid-template-columns:88px minmax(0,1fr) 90px 120px 150px;align-items:center;
  height:24px;padding:0 10px;color:var(--dsw-alias-label-primary);font-size:12px;cursor:default;}
.dgt-hrow:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dgt-hrow[data-active]{background:var(--dsw-alias-interactive-bg-active);}
.dgt-hrow:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px;}
.dgt-hgraph{display:flex;align-items:center;overflow:visible;}
.dgt-graph{display:block;overflow:visible;}
.dgt-hsubject{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden;}
.dgt-hsubject-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dgt-refchip{flex:0 0 auto;padding:0 6px;border-radius:999px;line-height:16px;font-size:10.5px;
  color:var(--dsw-alias-brand-text);background:color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
  border:1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, var(--dsw-alias-border-l2));}
.dgt-refchip[data-kind='tag']{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-3);
  border-color:var(--dsw-alias-border-l2);}
.dgt-hsha{font-family:var(--ds-font-family-code);font-size:11px;color:var(--dgt-meta);}
.dgt-hauthor,.dgt-hdate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--dsw-alias-label-secondary);font-size:11.5px;}
.dgt-hmore{display:flex;justify-content:center;padding:10px;}

/* commit detail */
.dgt-detail{flex:0 0 280px;max-height:46%;display:flex;min-height:0;border-top:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-1);}
.dgt-detail-side{flex:0 0 320px;min-width:0;display:flex;flex-direction:column;overflow:hidden;
  border-right:1px solid var(--dsw-alias-border-l2);}
.dgt-detail-meta{flex:0 0 auto;display:flex;flex-direction:column;gap:2px;padding:8px 10px;
  border-bottom:1px solid var(--dsw-alias-border-l1);}
.dgt-detail-subject{font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dgt-detail-sha{font-family:var(--ds-font-family-code);font-size:11px;color:var(--dgt-meta);}
.dgt-detail-line{display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:11.5px;
  color:var(--dsw-alias-label-secondary);}
.dgt-detail-label{color:var(--dsw-alias-label-tertiary);}
.dgt-link{appearance:none;border:0;background:transparent;padding:0 2px;color:var(--dsw-alias-brand-text);
  font:inherit;font-family:var(--ds-font-family-code);font-size:11px;text-decoration:underline;cursor:pointer;}
.dgt-detail-body{margin:4px 0 0;padding:0;max-height:56px;overflow:auto;white-space:pre-wrap;
  font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-secondary);}
.dgt-detail-head{flex:0 0 auto;display:flex;align-items:center;height:24px;padding:0 10px;
  background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l1);
  color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;}
.dgt-detail-list{flex:1 1 auto;min-height:0;overflow:auto;padding:2px;}
.dgt-detail-file{display:flex;align-items:center;gap:6px;width:100%;height:24px;padding:0 8px;
  border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;
  text-align:left;cursor:pointer;}
.dgt-detail-file:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dgt-detail-file[data-active]{background:var(--dsw-alias-interactive-bg-active);}
.dgt-detail-letter{flex:0 0 auto;width:12px;text-align:center;font-family:var(--ds-font-family-code);
  font-size:11px;font-weight:600;color:var(--dsw-alias-label-tertiary);}
.dgt-detail-letter[data-status='added']{color:var(--dgt-ok);}
.dgt-detail-letter[data-status='deleted']{color:var(--dgt-err);}
.dgt-detail-letter[data-status='modified']{color:var(--dgt-warn);}
.dgt-detail-letter[data-status='renamed']{color:var(--dsw-alias-brand-text);}
.dgt-detail-path{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  direction:rtl;text-align:left;}
.dgt-detail-diff{flex:1 1 auto;min-width:0;overflow:auto;background:var(--dsw-alias-bg-base);}
.dgt-rail-btn{appearance:none;border:0;width:100%;background:transparent;text-align:left;
  font:inherit;font-size:13px;cursor:pointer;}
.dgt-rail-title-right{display:inline-flex;align-items:center;gap:6px;}
.dgt-rail-add{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;
  padding:0;border:0;border-radius:var(--dsw-radius-xs);background:transparent;
  color:var(--dsw-alias-label-tertiary);font:inherit;font-size:14px;line-height:1;cursor:pointer;}
.dgt-rail-add:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}
.dgt-rail-ref{position:relative;cursor:pointer;}
.dgt-rail-ref:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dgt-rail-ref[data-menu='true']{background:var(--dsw-alias-interactive-bg-hover);}
.dgt-rail-ref .dgt-rail-more{display:inline-flex;align-items:center;justify-content:center;
  width:18px;height:18px;margin-left:auto;padding:0;border:0;border-radius:var(--dsw-radius-xs);
  background:transparent;color:var(--dsw-alias-label-tertiary);opacity:0;cursor:pointer;}
.dgt-rail-ref:hover .dgt-rail-more,.dgt-rail-ref:focus-within .dgt-rail-more,
.dgt-rail-ref[data-menu='true'] .dgt-rail-more{opacity:1;}
.dgt-rail-more:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}
.dgt-scope{display:inline-flex;align-items:center;gap:2px;height:22px;padding:0 4px 0 8px;
  border-radius:999px;background:var(--dsw-alias-bg-layer-1);
  border:1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, var(--dsw-alias-border-l2));
  color:var(--dsw-alias-brand-text);font-size:11.5px;}
.dgt-scope-clear{appearance:none;border:0;background:transparent;color:inherit;cursor:pointer;
  font:inherit;font-size:13px;line-height:1;padding:0 2px;}

/* list */
.dgt-list-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:0 0 auto;
  height:28px;padding:0 10px;border-bottom:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);
  font-size:12px;font-weight:600;}
.dgt-scroll{flex:1 1 auto;min-height:0;overflow:auto;padding:0;}
.dgt-group{display:flex;align-items:center;justify-content:space-between;height:27px;padding:0 10px;
  background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l2);
  color:var(--dsw-alias-label-secondary);font-size:11.5px;font-weight:500;}
.dgt-group[data-tone='error']{color:var(--dsw-alias-state-error-primary);}
.dgt-group-count{color:var(--dgt-meta);font-size:11.5px;font-variant-numeric:tabular-nums;font-weight:400;}
.dgt-row{position:relative;display:flex;align-items:center;gap:6px;width:100%;height:27px;
  padding:0 8px;border:0;background:transparent;color:var(--dsw-alias-label-primary);
  font:inherit;font-size:13px;text-align:left;cursor:default;}
.dgt-row:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dgt-row[data-active='true']{background:var(--dsw-alias-interactive-bg-active);}
.dgt-row:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px;}
.dgt-row[data-menu='true']{background:var(--dsw-alias-interactive-bg-hover);}
.dgt-row[data-active='true'] .dgt-path-name{font-weight:600;}
.dgt-check{flex:0 0 auto;width:13px;height:13px;margin:0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer;}
.dgt-badge{flex:0 0 auto;display:inline-grid;place-items:center;width:16px;height:16px;border-radius:4px;
  font-family:var(--ds-font-family-code);font-size:10.5px;font-weight:600;color:var(--dsw-alias-label-secondary);
  background:var(--dsw-alias-bg-layer-3);}
.dgt-badge[data-tone='ok']{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 18%, var(--dsw-alias-bg-layer-1));color:var(--dgt-ok);}
.dgt-badge[data-tone='warn']{background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 20%, var(--dsw-alias-bg-layer-1));color:var(--dgt-warn);}
.dgt-badge[data-tone='error']{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 16%, var(--dsw-alias-bg-layer-1));color:var(--dgt-err);}
.dgt-badge[data-tone='accent']{background:color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-brand-text);}
.dgt-rowact{appearance:none;flex:0 0 auto;margin-left:auto;padding:1px 6px;border:0;border-radius:4px;
  background:transparent;color:var(--dsw-alias-brand-text);font:inherit;font-size:11.5px;cursor:pointer;opacity:0;}
.dgt-row:hover .dgt-rowact,.dgt-row:focus-within .dgt-rowact{opacity:1;}
.dgt-rowact:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dgt-rowact[data-disabled]{opacity:1;color:var(--dgt-warn);cursor:default;}
.dgt-letter[data-tone='ok']{color:var(--dgt-ok);}
.dgt-letter[data-tone='warn']{color:var(--dgt-warn);}
.dgt-letter[data-tone='error']{color:var(--dgt-err);}
.dgt-letter[data-tone='accent']{color:var(--dsw-alias-brand-text);}
.dgt-path{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left;}
.dgt-path-dir{color:var(--dsw-alias-label-tertiary);}
.dgt-path-name{color:var(--dsw-alias-label-primary);}
.dgt-more{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;
  padding:0;border:0;border-radius:var(--dsw-radius-xs);background:transparent;opacity:0;
  color:var(--dsw-alias-label-tertiary);cursor:pointer;}
.dgt-row:hover .dgt-more,.dgt-row:focus-within .dgt-more,.dgt-more[data-open='true']{opacity:1;}
.dgt-more:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}
.dgt-menu{position:absolute;right:6px;top:24px;z-index:5;min-width:132px;padding:4px;
  border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-layer-3);box-shadow:0 6px 18px var(--dsw-alias-bg-mask-1);}
.dgt-menu button{display:block;width:100%;padding:4px 8px;border:0;border-radius:var(--dsw-radius-xs);
  background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;
  text-align:left;cursor:pointer;}
.dgt-menu button:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dgt-placeholder{padding:14px 12px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;}
.dgt-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
  height:100%;min-height:120px;color:var(--dsw-alias-label-secondary);font-size:12.5px;}
.dgt-empty-hint{color:var(--dsw-alias-label-tertiary);font-size:11.5px;}
.dgt-banner{display:flex;align-items:center;gap:8px;margin:8px 10px;padding:6px 10px;flex:0 0 auto;
  border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;}
.dgt-banner[data-tone='error']{color:var(--dsw-alias-state-error-primary);}
.dgt-banner-text{flex:1 1 auto;min-width:0;}
.dgt-banner button{appearance:none;border:0;background:transparent;color:inherit;cursor:pointer;
  font:inherit;font-size:11px;opacity:.8;}

/* diff */
.dgt-diff-head{display:flex;align-items:center;gap:8px;flex:0 0 auto;height:30px;padding:0 10px;
  border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);
  font-size:12px;color:var(--dsw-alias-label-secondary);}
.dgt-diff-path{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--dsw-alias-label-primary);}
.dgt-diff-orig{color:var(--dsw-alias-label-caption);font-size:11px;}
.dgt-stats{display:flex;gap:6px;font-size:11px;font-variant-numeric:tabular-nums;}
.dgt-stat-add{color:var(--dgt-ok);font-weight:500;}
.dgt-stat-del{color:var(--dgt-err);font-weight:500;}
.dgt-diff-action{appearance:none;height:24px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;font-weight:500;cursor:pointer;}
.dgt-diff-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}
.dgt-diff-action[data-kind='stage']{border-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, var(--dsw-alias-border-l2));color:var(--dsw-alias-brand-text);}
.dgt-diff-body{flex:1 1 auto;min-height:0;overflow:auto;background:var(--dsw-alias-bg-base);}
.dgt-hunk-head{display:flex;align-items:center;justify-content:space-between;gap:8px;height:28px;
  padding:0 10px;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);
  font-family:var(--ds-font-family-code);font-size:11px;white-space:nowrap;overflow:hidden;}
.dgt-hunk-head span{overflow:hidden;text-overflow:ellipsis;}
.dgt-line{display:flex;min-width:max-content;height:18px;line-height:18px;
  font-family:var(--ds-font-family-code);font-size:11px;white-space:pre;color:var(--dsw-alias-label-secondary);}
.dgt-line[data-kind='add']{background:var(--dsw-alias-file-diff-added-bg);}
.dgt-line[data-kind='del']{background:var(--dsw-alias-file-diff-deleted-bg);}
.dgt-line[data-kind='meta']{color:var(--dsw-alias-label-caption);font-style:italic;}
.dgt-gutter{flex:0 0 40px;text-align:right;padding-right:6px;user-select:none;
  color:var(--dgt-meta);font-size:11px;font-variant-numeric:tabular-nums;
  border-right:1px solid var(--dsw-alias-border-l1);}
.dgt-line[data-kind='add'] .dgt-gutter{background:var(--dsw-alias-file-diff-added-gutter);}
.dgt-line[data-kind='del'] .dgt-gutter{background:var(--dsw-alias-file-diff-deleted-gutter);}
.dgt-marker{flex:0 0 14px;text-align:center;user-select:none;color:var(--dsw-alias-label-caption);}
.dgt-line[data-kind='add'] .dgt-marker{color:var(--dsw-alias-file-diff-added-marker);}
.dgt-line[data-kind='del'] .dgt-marker{color:var(--dsw-alias-file-diff-deleted-marker);}
.dgt-text{flex:1 1 auto;padding:0 12px 0 6px;}

/* commit box */
.dgt-commit{flex:0 0 auto;display:flex;flex-direction:column;gap:6px;padding:8px 12px 10px;
  border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);}
.dgt-commit-meta{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dsw-alias-label-tertiary);}
.dgt-avatar{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;
  border-radius:50%;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);
  font-size:10px;font-weight:600;flex:0 0 auto;}
.dgt-commit-author{color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dgt-commit-branch{color:var(--dsw-alias-label-caption);}
.dgt-commit-input{box-sizing:border-box;width:100%;min-height:66px;max-height:140px;resize:vertical;
  padding:7px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);
  font:inherit;font-size:12.5px;line-height:18px;}
.dgt-commit-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary);}
.dgt-commit-input::placeholder{color:var(--dsw-alias-label-caption);}
.dgt-commit-foot{display:flex;align-items:center;gap:10px;}
.dgt-hint{flex:1 1 auto;min-width:0;color:var(--dgt-meta);font-size:11.5px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dgt-hint[data-tone='error']{color:var(--dsw-alias-state-error-primary);}
.dgt-primary{appearance:none;height:26px;padding:0 14px;border:1px solid transparent;
  border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-brand-primary);
  color:var(--dsw-alias-label-primary-inverted);font:inherit;font-size:12px;font-weight:500;cursor:pointer;}
.dgt-primary:hover:not(:disabled){opacity:.92;}
.dgt-primary:disabled{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-secondary);cursor:default;}
.dgt-overlay{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
  background:var(--dsw-alias-bg-mask-1);}
.dgt-dialog{width:340px;max-width:88vw;display:flex;flex-direction:column;gap:8px;padding:14px;
  border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-3);box-shadow:0 12px 32px var(--dsw-alias-bg-mask-1);}
.dgt-dialog-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);}
.dgt-dialog-label{font-size:11.5px;color:var(--dsw-alias-label-secondary);}
.dgt-dialog-body{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}
.dgt-dialog-input{height:28px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);
  color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;}
.dgt-dialog-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary);}
.dgt-dialog-error{font-size:11.5px;color:var(--dgt-err);}
.dgt-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px;}
.dgt-danger{background:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-label-primary-inverted);}
.dgt-ctxmenu{position:fixed;z-index:80;min-width:200px;max-width:280px;padding:5px;
  border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-layer-3);box-shadow:0 12px 32px var(--dsw-alias-bg-mask-1);}
.dgt-ctxmenu-title{padding:5px 8px 6px;margin-bottom:4px;border-bottom:1px solid var(--dsw-alias-border-l1);
  font-size:11px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dgt-ctxmenu-item{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;
  height:28px;padding:0 8px;border:0;border-radius:var(--dsw-radius-xs);background:transparent;
  color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;text-align:left;cursor:pointer;}
.dgt-ctxmenu-item:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);}
.dgt-ctxmenu-item:disabled{color:var(--dsw-alias-label-caption);cursor:default;}
.dgt-ctxmenu-item[data-danger='true']:not(:disabled){color:var(--dgt-err);}
.dgt-ctxmenu-item kbd{font:10.5px var(--ds-font-family-code);color:var(--dsw-alias-label-tertiary);}
.dgt-ctxmenu-divider{height:1px;margin:4px 2px;background:var(--dsw-alias-border-l1);}
.dgt-toast{position:absolute;right:14px;bottom:118px;z-index:6;max-width:60%;
  padding:6px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);
  background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font-size:12px;
  box-shadow:0 6px 18px var(--dsw-alias-bg-mask-1);}
`
