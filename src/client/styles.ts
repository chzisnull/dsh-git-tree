// Plugin-owned stylesheet — "mist" direction: a pale tinted page, white
// floating cards with soft radii, hairlines only where they carry structure,
// one accent (the host's business blue) and generous row rhythm.
// Every colour is a --dsw-* token or a color-mix of tokens.

export const CSS = `
.dgt-root{position:relative;box-sizing:border-box;height:100%;min-height:0;display:flex;flex-direction:column;
  gap:10px;padding:14px 16px 16px;
  background:var(--dgt-page);color:var(--dsw-alias-label-primary);
  font-family:var(--dsw-font-family);font-size:12.5px;line-height:1.55;
  --dgt-accent:var(--dsw-alias-state-business-primary);
  --dgt-accent-strong:color-mix(in srgb, var(--dsw-alias-state-business-primary) 85%, var(--dsw-alias-label-primary));
  --dgt-accent-soft:color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, var(--dsw-alias-bg-layer-1));
  --dgt-page:color-mix(in srgb, var(--dsw-alias-state-business-primary) 3%, var(--dsw-alias-bg-base));
  --dgt-card:var(--dsw-alias-bg-layer-1);
  --dgt-rail-bg:color-mix(in srgb, var(--dsw-alias-state-business-primary) 2%, var(--dsw-alias-bg-layer-1));
  --dgt-line:var(--dsw-alias-border-l2);
  --dgt-line-soft:color-mix(in srgb, var(--dsw-alias-border-l2) 55%, transparent);
  --dgt-shadow:0 2px 10px var(--dsw-alias-bg-mask-1);
  --dgt-ok:color-mix(in srgb, var(--dsw-alias-state-success-primary) 55%, var(--dsw-alias-label-primary));
  --dgt-warn:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 58%, var(--dsw-alias-label-primary));
  --dgt-err:color-mix(in srgb, var(--dsw-alias-state-error-primary) 70%, var(--dsw-alias-label-primary));
  --dgt-meta:var(--dsw-alias-label-secondary);
  --dgt-lane-0:var(--dgt-accent);
  --dgt-lane-1:color-mix(in srgb, var(--dsw-alias-state-success-primary) 80%, var(--dsw-alias-label-primary));
  --dgt-lane-2:var(--dsw-alias-state-warn-primary);
  --dgt-lane-3:var(--dsw-alias-state-error-primary);
  --dgt-lane-4:var(--dsw-alias-label-primary-bluish);}

/* toolbar card */
.dgt-topbar{display:flex;align-items:center;gap:14px;flex:0 0 auto;height:48px;padding:0 16px;
  border:1px solid var(--dgt-line);border-radius:14px;background:var(--dgt-card);box-shadow:var(--dgt-shadow);}
.dgt-repo{position:relative;display:flex;align-items:baseline;gap:9px;min-width:0;}
.dgt-repo-switch{display:inline-flex;align-items:center;gap:5px;margin-left:-4px;padding:2px 4px;
  border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);
  font:inherit;font-size:14px;font-weight:600;letter-spacing:-.01em;cursor:pointer;max-width:24vw;}
.dgt-repo-switch:hover{background:var(--dgt-accent-soft);}
.dgt-repo-caret{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1;}
.dgt-repo-path{font-size:11px;color:var(--dsw-alias-label-tertiary);max-width:26vw;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left;}
.dgt-repo-menu{position:absolute;left:0;top:calc(100% + 10px);z-index:30;min-width:300px;max-width:440px;
  max-height:330px;overflow:auto;padding:6px;border:1px solid var(--dgt-line);border-radius:12px;
  background:var(--dgt-card);box-shadow:0 12px 30px var(--dsw-alias-bg-mask-1);scrollbar-width:thin;}
.dgt-repo-filter{box-sizing:border-box;width:100%;height:28px;margin-bottom:5px;padding:0 9px;
  border:1px solid var(--dgt-line);border-radius:8px;background:var(--dgt-page);
  color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;}
.dgt-repo-filter:focus{outline:none;border-color:var(--dgt-accent);}
.dgt-repo-filter::placeholder{color:var(--dsw-alias-label-tertiary);}
.dgt-repo-menu-item{display:flex;flex-direction:column;align-items:flex-start;gap:1px;width:100%;
  padding:6px 9px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);
  font:inherit;text-align:left;cursor:pointer;}
.dgt-repo-menu-item:hover{background:var(--dgt-accent-soft);}
.dgt-repo-menu-item[data-current]{background:var(--dgt-accent-soft);}
.dgt-repo-menu-title{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:500;}
.dgt-repo-check{width:12px;color:var(--dgt-accent-strong);font-size:11px;}
.dgt-repo-menu-path{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--dsw-alias-label-tertiary);font-size:10.5px;direction:rtl;text-align:left;}
.dgt-repo-menu-empty{padding:6px 9px;color:var(--dsw-alias-label-tertiary);font-size:11.5px;}

/* branch / sync pills */
.dgt-refs{display:flex;align-items:center;gap:6px;margin-left:auto;min-width:0;}
.dgt-chip{display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 10px;border-radius:999px;
  background:var(--dgt-accent-soft);color:var(--dgt-accent-strong);font-size:11px;line-height:1;white-space:nowrap;}
.dgt-chip[data-tone='muted']{background:var(--dgt-line-soft);color:var(--dsw-alias-label-secondary);}
.dgt-chip[data-tone='ok']{color:var(--dgt-ok);background:var(--dgt-line-soft);}
.dgt-chip[data-tone='warn']{color:var(--dgt-warn);background:var(--dgt-line-soft);}
.dgt-upstream{font-size:11px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;max-width:18vw;}
.dgt-actions{display:flex;align-items:center;gap:2px;}
.dgt-iconbtn{appearance:none;display:inline-flex;align-items:center;justify-content:center;
  width:30px;height:30px;padding:0;border:0;border-radius:9px;background:transparent;
  color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;}
.dgt-iconbtn:hover:not(:disabled){background:var(--dgt-line-soft);color:var(--dsw-alias-label-primary);}
.dgt-iconbtn:disabled{color:var(--dsw-alias-label-caption);cursor:default;}
.dgt-iconbtn[data-busy='true'] svg{animation:dgt-spin .9s linear infinite;}
@keyframes dgt-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.dgt-iconbtn[data-busy='true'] svg{animation:none}}

/* floating body card */
.dgt-body{display:flex;flex:1 1 auto;min-height:0;border:1px solid var(--dgt-line);border-radius:14px;
  overflow:hidden;background:var(--dgt-card);box-shadow:0 2px 10px var(--dsw-alias-bg-mask-1);}

/* rail */
.dgt-rail{flex:0 0 212px;min-width:0;display:flex;flex-direction:column;overflow:auto;
  padding:14px 10px 12px;border-right:1px solid var(--dgt-line-soft);background:var(--dgt-rail-bg);}
.dgt-rail-title{display:flex;align-items:center;justify-content:space-between;height:26px;padding:0 8px;
  margin-top:12px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;}
.dgt-rail-title:first-child{margin-top:0;}
.dgt-rail-title-right{display:inline-flex;align-items:center;gap:6px;}
.dgt-rail-add{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;padding:0;
  border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-tertiary);
  font:inherit;font-size:14px;line-height:1;cursor:pointer;}
.dgt-rail-add:hover{background:var(--dgt-line-soft);color:var(--dsw-alias-label-primary);}
.dgt-rail-row{display:flex;align-items:center;gap:8px;height:32px;padding:0 9px;border-radius:9px;
  color:var(--dsw-alias-label-secondary);font-size:12.5px;white-space:nowrap;}
.dgt-rail-row[data-active='true']{background:var(--dgt-accent-soft);color:var(--dgt-accent-strong);font-weight:600;}
.dgt-rail-row[data-current='true']{color:var(--dsw-alias-label-primary);font-weight:500;}
.dgt-rail-row[data-muted='true']{color:var(--dsw-alias-label-tertiary);}
.dgt-rail-icon{display:inline-flex;align-items:center;color:var(--dsw-alias-label-tertiary);flex:0 0 auto;width:13px;}
.dgt-rail-row[data-current='true'] .dgt-rail-icon{color:var(--dgt-accent-strong);}
.dgt-rail-row[data-active='true'] .dgt-rail-icon{color:var(--dgt-accent-strong);}
.dgt-rail-dot{width:6px;height:6px;border-radius:50%;background:var(--dgt-accent);flex:0 0 auto;}
.dgt-rail-name{overflow:hidden;text-overflow:ellipsis;}
.dgt-rail-empty{padding:3px 9px 5px;color:var(--dsw-alias-label-tertiary);font-size:11px;}
.dgt-rail-btn{appearance:none;border:0;width:100%;background:transparent;text-align:left;
  font:inherit;font-size:12.5px;cursor:pointer;}
.dgt-rail-ref{position:relative;cursor:pointer;}
.dgt-rail-ref:hover{background:var(--dgt-line-soft);}
.dgt-rail-ref[data-menu='true']{background:var(--dgt-line-soft);}
.dgt-rail-ref .dgt-rail-more{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;
  margin-left:auto;padding:0;border:0;border-radius:5px;background:transparent;
  color:var(--dsw-alias-label-tertiary);opacity:0;cursor:pointer;}
.dgt-rail-ref:hover .dgt-rail-more,.dgt-rail-ref:focus-within .dgt-rail-more,
.dgt-rail-ref[data-menu='true'] .dgt-rail-more{opacity:1;}
.dgt-rail-more:hover{background:var(--dgt-line-soft);color:var(--dsw-alias-label-primary);}

/* panes */
.dgt-main{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;min-height:0;}
.dgt-panes{display:flex;flex:1 1 auto;min-height:0;min-width:0;}
.dgt-list{display:flex;flex-direction:column;flex:0 0 358px;min-width:0;min-height:0;
  border-right:1px solid var(--dgt-line-soft);}
.dgt-right{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;min-height:0;padding:0 16px 14px;}
.dgt-diff{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;min-height:0;}

/* change list */
.dgt-list-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:0 0 auto;
  height:44px;padding:0 16px;color:var(--dsw-alias-label-tertiary);font-size:11px;}
.dgt-list-head b,:where(.dgt-list-head) span:first-child{color:var(--dsw-alias-label-primary);
  font-size:12.5px;font-weight:600;}
.dgt-list-sort{margin-left:auto;margin-right:10px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;font-weight:400;}
.dgt-group-count{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;font-weight:400;font-size:10.5px;}
.dgt-regions{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;padding:0 8px;}
.dgt-region{display:flex;flex-direction:column;min-height:0;}
.dgt-region[data-kind='conflicted']{flex:0 1 auto;max-height:34%;border-bottom:1px solid var(--dgt-line-soft);}
.dgt-region[data-kind='staged']{flex:1 1 40%;min-height:104px;border-bottom:1px solid var(--dgt-line-soft);padding-bottom:6px;}
.dgt-region[data-kind='unstaged']{flex:1 1 60%;padding-top:2px;}
.dgt-region-scroll{flex:1 1 auto;min-height:0;overflow:auto;padding:0;}
.dgt-group{display:flex;align-items:center;justify-content:space-between;height:28px;padding:0 8px;
  color:var(--dsw-alias-label-tertiary);font-size:10.5px;}
.dgt-group[data-tone='error']{color:var(--dgt-err);}
.dgt-row{position:relative;box-sizing:border-box;display:flex;align-items:center;gap:9px;width:100%;height:34px;
  padding:0 9px;border:0;border-radius:9px;background:transparent;color:var(--dsw-alias-label-primary);
  font:inherit;font-size:12.5px;text-align:left;cursor:default;}
.dgt-row:hover{background:var(--dgt-line-soft);}
.dgt-row:focus-visible{outline:2px solid var(--dgt-accent);outline-offset:-2px;}
.dgt-row[data-active='true']{background:var(--dgt-accent-soft);}
.dgt-row[data-active='true'] .dgt-path-name{font-weight:600;}
.dgt-row[data-menu='true']{background:var(--dgt-line-soft);}
.dgt-check{flex:0 0 auto;width:14px;height:14px;margin:0;accent-color:var(--dgt-accent-strong);cursor:pointer;}
.dgt-badge{flex:0 0 auto;display:inline-grid;place-items:center;width:16px;height:16px;border-radius:5px;
  font-family:var(--ds-font-family-code);font-size:10px;font-weight:600;color:var(--dsw-alias-label-secondary);
  background:var(--dgt-line-soft);}
.dgt-badge[data-tone='ok']{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 16%, var(--dgt-card));color:var(--dgt-ok);}
.dgt-badge[data-tone='warn']{background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 18%, var(--dgt-card));color:var(--dgt-warn);}
.dgt-badge[data-tone='error']{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 14%, var(--dgt-card));color:var(--dgt-err);}
.dgt-badge[data-tone='accent']{background:var(--dgt-accent-soft);color:var(--dgt-accent-strong);}
.dgt-badge[data-tone='muted']{background:var(--dgt-line-soft);color:var(--dsw-alias-label-secondary);}
.dgt-path{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left;}
.dgt-path-dir{color:var(--dsw-alias-label-tertiary);}
.dgt-path-name{color:var(--dsw-alias-label-primary);}
.dgt-rowact{appearance:none;flex:0 0 auto;margin-left:auto;padding:1px 8px;border:0;border-radius:6px;
  background:transparent;color:var(--dgt-accent-strong);font:inherit;font-size:11px;cursor:pointer;opacity:.85;white-space:nowrap;}
.dgt-row:hover .dgt-rowact,.dgt-row:focus-within .dgt-rowact{opacity:1;}
.dgt-rowact:hover{background:var(--dgt-accent-soft);}
.dgt-rowact[data-disabled]{opacity:1;color:var(--dgt-warn);cursor:default;}

/* diff */
.dgt-diff-head{display:flex;align-items:center;gap:10px;flex:0 0 auto;height:44px;color:var(--dsw-alias-label-secondary);font-size:12.5px;}
.dgt-diff-path{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--dsw-alias-label-primary);font-weight:600;}
.dgt-diff-orig{color:var(--dsw-alias-label-tertiary);font-size:11px;}
.dgt-stats{display:flex;gap:6px;font-size:10.5px;font-variant-numeric:tabular-nums;}
.dgt-stat-add{color:var(--dgt-ok);font-weight:500;}
.dgt-stat-del{color:var(--dgt-err);font-weight:500;}
.dgt-diff-action{appearance:none;height:24px;padding:0 10px;border:1px solid var(--dgt-line);border-radius:8px;
  background:var(--dgt-card);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;cursor:pointer;}
.dgt-diff-action:hover{background:var(--dgt-line-soft);color:var(--dsw-alias-label-primary);}
.dgt-diff-action[data-kind='stage']{border-color:color-mix(in srgb, var(--dgt-accent) 40%, var(--dgt-line));color:var(--dgt-accent-strong);}
.dgt-diff-body{flex:1 1 auto;min-height:0;overflow:auto;}
.dgt-hunk-head{display:flex;align-items:center;justify-content:space-between;gap:8px;height:30px;
  margin:0;padding:0 10px;border-top:1px solid var(--dgt-line-soft);border-bottom:1px solid var(--dgt-line-soft);
  background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 2%, var(--dgt-card));
  color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);font-size:10.5px;
  white-space:nowrap;overflow:hidden;}
.dgt-hunk-head span{overflow:hidden;text-overflow:ellipsis;}
.dgt-code,.dgt-line{display:flex;min-width:max-content;height:21px;line-height:21px;
  font-family:var(--ds-font-family-code);font-size:11.5px;white-space:pre;color:var(--dsw-alias-label-secondary);}
.dgt-line{margin:0;}
.dgt-line[data-kind='add']{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 7%, var(--dgt-card));}
.dgt-line[data-kind='del']{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 6%, var(--dgt-card));}
.dgt-line[data-kind='meta']{color:var(--dsw-alias-label-tertiary);font-style:italic;}
.dgt-gutter{flex:0 0 40px;text-align:right;padding-right:10px;user-select:none;
  color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;}
.dgt-line .dgt-gutter:first-child{padding-left:10px;}
.dgt-marker{flex:0 0 16px;text-align:center;user-select:none;color:var(--dsw-alias-label-tertiary);}
.dgt-line[data-kind='add'] .dgt-marker{color:var(--dgt-ok);}
.dgt-line[data-kind='del'] .dgt-marker{color:var(--dgt-err);}
.dgt-text{flex:1 1 auto;padding:0 16px 0 6px;}
.dgt-placeholder{padding:14px 12px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;}
.dgt-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
  height:100%;min-height:120px;color:var(--dsw-alias-label-secondary);font-size:12.5px;}
.dgt-empty-hint{color:var(--dsw-alias-label-tertiary);font-size:11.5px;}

/* history */
.dgt-history{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;min-height:0;padding:0 16px 14px;}
.dgt-htoolbar{display:flex;align-items:center;gap:10px;flex:0 0 auto;height:46px;}
.dgt-seg{display:inline-flex;padding:2px;border-radius:9px;background:var(--dgt-line-soft);}
.dgt-seg-btn{appearance:none;border:0;height:26px;padding:0 11px;border-radius:7px;background:transparent;
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;}
.dgt-seg-btn:hover{color:var(--dsw-alias-label-primary);}
.dgt-seg-btn[data-active]{background:var(--dgt-card);color:var(--dgt-accent-strong);font-weight:600;
  box-shadow:0 1px 3px var(--dsw-alias-bg-mask-1);}
.dgt-resultcount{margin-left:10px;color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap;}
.dgt-searchbar{display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0;margin-left:auto;justify-content:flex-end;}
.dgt-filter{display:flex;align-items:center;gap:6px;min-width:0;}
.dgt-filter>span{font-size:10.5px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;}
.dgt-filter-narrow{flex:0 1 190px;}
.dgt-search-input{flex:1 1 auto;min-width:70px;height:28px;padding:0 9px;border:1px solid var(--dgt-line);
  border-radius:8px;background:var(--dgt-page);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;}
.dgt-search-input:focus{outline:none;border-color:var(--dgt-accent);}
.dgt-search-input::placeholder{color:var(--dsw-alias-label-tertiary);}
.dgt-scope{display:inline-flex;align-items:center;gap:2px;height:24px;padding:0 4px 0 9px;border-radius:999px;
  background:var(--dgt-accent-soft);color:var(--dgt-accent-strong);font-size:11px;}
.dgt-scope-clear{appearance:none;border:0;background:transparent;color:inherit;cursor:pointer;
  font:inherit;font-size:13px;line-height:1;padding:0 3px;}
.dgt-hhead{display:grid;grid-template-columns:88px minmax(0,1fr) 132px 84px 108px 138px;align-items:center;
  flex:0 0 auto;height:30px;color:var(--dsw-alias-label-tertiary);font-size:10.5px;
  border-top:1px solid var(--dgt-line-soft);border-bottom:1px solid var(--dgt-line-soft);}
.dgt-hscroll{flex:1 1 auto;min-height:0;overflow:auto;}
.dgt-hlist{padding:4px 0 10px;}
.dgt-hrow{box-sizing:border-box;display:grid;grid-template-columns:88px minmax(0,1fr) 132px 84px 108px 138px;
  align-items:center;height:32px;padding:0 4px;border-radius:9px;color:var(--dsw-alias-label-primary);font-size:12.5px;cursor:default;}
.dgt-hrow:hover{background:var(--dgt-line-soft);}
.dgt-hrow[data-active]{background:var(--dgt-accent-soft);}
.dgt-hrow[data-active] .dgt-hsubject-text{font-weight:600;}
.dgt-hrow:focus-visible{outline:2px solid var(--dgt-accent);outline-offset:-2px;}
.dgt-hgraph{display:flex;align-items:center;overflow:visible;}
.dgt-graph{display:block;overflow:visible;}
.dgt-hsubject{display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden;}
.dgt-hsubject-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dgt-hrefs{display:flex;align-items:center;gap:4px;min-width:0;overflow:hidden;}
.dgt-refchip{flex:0 0 auto;padding:0 7px;border-radius:999px;line-height:17px;font-size:10px;
  color:var(--dgt-accent-strong);background:var(--dgt-accent-soft);border:1px solid transparent;}
.dgt-refchip[data-kind='tag']{color:var(--dsw-alias-label-secondary);background:var(--dgt-line-soft);}
.dgt-refchip[data-kind='more']{color:var(--dsw-alias-label-tertiary);background:transparent;border-color:var(--dgt-line);}
.dgt-hsha{font-family:var(--ds-font-family-code);font-size:10.5px;color:var(--dsw-alias-label-tertiary);}
.dgt-hauthor,.dgt-hdate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--dsw-alias-label-secondary);font-size:11px;}
.dgt-hmore{display:flex;justify-content:center;padding:12px;}
.dgt-detail{flex:0 0 280px;max-height:46%;display:flex;min-height:0;margin-top:10px;
  border:1px solid var(--dgt-line);border-radius:12px;background:var(--dgt-card);overflow:hidden;}
.dgt-detail-side{flex:0 0 360px;min-width:0;display:flex;flex-direction:column;overflow:hidden;
  border-right:1px solid var(--dgt-line-soft);}
.dgt-detail-meta{flex:0 0 auto;display:flex;flex-direction:column;gap:3px;padding:12px 14px;
  border-bottom:1px solid var(--dgt-line-soft);}
.dgt-detail-subject{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dgt-detail-sha{font-family:var(--ds-font-family-code);font-size:10.5px;color:var(--dsw-alias-label-tertiary);}
.dgt-detail-line{display:flex;align-items:center;gap:5px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-secondary);}
.dgt-detail-label{color:var(--dsw-alias-label-tertiary);}
.dgt-link{appearance:none;border:0;background:transparent;padding:0 2px;color:var(--dgt-accent-strong);
  font:inherit;font-family:var(--ds-font-family-code);font-size:10.5px;text-decoration:underline;cursor:pointer;}
.dgt-detail-body{margin:4px 0 0;padding:0;max-height:56px;overflow:auto;white-space:pre-wrap;
  font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);}
.dgt-detail-head{flex:0 0 auto;display:flex;align-items:center;height:30px;padding:0 14px;
  color:var(--dsw-alias-label-tertiary);font-size:10.5px;}
.dgt-detail-list{flex:1 1 auto;min-height:0;overflow:auto;padding:2px 8px 8px;}
.dgt-detail-file{display:flex;align-items:center;gap:8px;width:100%;height:30px;padding:0 8px;
  border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);
  font:inherit;font-size:12px;text-align:left;cursor:pointer;}
.dgt-detail-file:hover{background:var(--dgt-line-soft);}
.dgt-detail-file[data-active]{background:var(--dgt-accent-soft);}
.dgt-detail-letter{flex:0 0 auto;width:14px;text-align:center;font-family:var(--ds-font-family-code);
  font-size:10px;font-weight:600;color:var(--dsw-alias-label-tertiary);}
.dgt-detail-letter[data-status='added']{color:var(--dgt-ok);}
.dgt-detail-letter[data-status='deleted']{color:var(--dgt-err);}
.dgt-detail-letter[data-status='modified']{color:var(--dgt-warn);}
.dgt-detail-letter[data-status='renamed']{color:var(--dgt-accent-strong);}
.dgt-detail-path{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  direction:rtl;text-align:left;}
.dgt-detail-diff{flex:1 1 auto;min-width:0;overflow:auto;}

/* commit card */
.dgt-commit{flex:0 0 auto;display:flex;flex-direction:column;gap:8px;margin-top:10px;padding:12px 14px 13px;
  border:1px solid var(--dgt-line);border-radius:12px;background:var(--dgt-card);
  box-shadow:0 2px 12px var(--dsw-alias-bg-mask-1);}
/* Folded: one strip that gives the diff the space back. Clicking it unfolds.
   The body keeps its DOM so 0fr → 1fr can animate the height without measuring;
   folded it is inert, so the hidden controls leave the tab order too. */
.dgt-commit{transition:padding .22s cubic-bezier(.2,.8,.2,1),gap .22s cubic-bezier(.2,.8,.2,1),
  box-shadow .22s ease;}
.dgt-commit-body{display:grid;grid-template-rows:1fr;transition:grid-template-rows .22s cubic-bezier(.2,.8,.2,1);}
.dgt-commit-body[data-folded='true']{grid-template-rows:0fr;}
.dgt-commit-body-inner{min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:8px;
  opacity:1;transition:opacity .18s ease .05s;}
.dgt-commit-body[data-folded='true'] .dgt-commit-body-inner{opacity:0;transition:opacity .1s ease;}
.dgt-commit[data-collapsed]{padding:7px 10px 7px 12px;gap:0;box-shadow:0 1px 4px var(--dsw-alias-bg-mask-1);}
.dgt-commit[data-collapsed] .dgt-commit-meta{width:100%;gap:9px;cursor:pointer;min-height:24px;}
.dgt-commit[data-collapsed] .dgt-commit-meta:hover .dgt-commit-preview{color:var(--dsw-alias-label-secondary);}
.dgt-commit-preview{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  text-align:right;color:var(--dsw-alias-label-tertiary);font-size:11px;transition:color .15s ease;}
.dgt-commit-preview[data-empty]{color:var(--dsw-alias-label-tertiary);}
/* The fold control is a labelled pill, not a bare caret: same spot in both
   states, a word that says what happens, and a border so it reads as a button. */
.dgt-commit-toggle{appearance:none;display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;
  margin-left:auto;height:24px;padding:0 8px 0 9px;border:1px solid var(--dgt-line);border-radius:8px;
  background:var(--dgt-card);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;
  line-height:1;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease;}
.dgt-commit-toggle:hover{border-color:color-mix(in srgb, var(--dgt-accent) 35%, var(--dgt-line));
  background:var(--dgt-accent-soft);color:var(--dgt-accent-strong);}
.dgt-commit-toggle:focus-visible{outline:none;border-color:var(--dgt-accent);
  box-shadow:0 0 0 2px var(--dgt-accent-soft);}
.dgt-commit-toggle-label{white-space:nowrap;}
.dgt-commit-caret{font-size:10px;line-height:1;transition:transform .22s cubic-bezier(.2,.8,.2,1);}
.dgt-commit[data-collapsed] .dgt-commit-caret{transform:rotate(180deg);}
@media (prefers-reduced-motion:reduce){
  .dgt-commit,.dgt-commit-body,.dgt-commit-body-inner,.dgt-commit-caret,.dgt-commit-toggle{transition:none;}
}
.dgt-commit-meta{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dsw-alias-label-secondary);}
.dgt-avatar{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;
  background:var(--dgt-accent-soft);color:var(--dgt-accent-strong);font-size:9.5px;font-weight:600;flex:0 0 auto;}
.dgt-commit-author{color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dgt-commit-branch{color:var(--dsw-alias-label-tertiary);}
.dgt-commit-label{display:flex;align-items:center;justify-content:space-between;margin-top:2px;
  font-size:10.5px;color:var(--dsw-alias-label-tertiary);}
.dgt-commit-input{box-sizing:border-box;width:100%;min-height:56px;max-height:140px;resize:vertical;
  padding:8px 10px;border:1px solid var(--dgt-line);border-radius:9px;background:var(--dgt-page);
  color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;line-height:19px;}
.dgt-commit-input:focus{outline:none;border-color:var(--dgt-accent);}
.dgt-commit-input::placeholder{color:var(--dsw-alias-label-tertiary);}
.dgt-commit-check{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--dsw-alias-label-secondary);cursor:pointer;}
.dgt-commit-check input{accent-color:var(--dgt-accent-strong);margin:0;width:13px;height:13px;}
.dgt-commit-check[data-disabled]{opacity:.75;cursor:default;}
.dgt-commit-check em{font-style:normal;color:var(--dsw-alias-label-tertiary);font-size:10.5px;}

/* Conflict pane: marker blocks, ours/theirs tints, resolve actions */
.dgt-conflict{display:flex;flex-direction:column;min-height:0;}
.dgt-conflict-head{display:flex;align-items:center;gap:10px;padding:7px 12px;border-bottom:1px solid var(--dgt-line-soft);
  background:color-mix(in srgb, var(--dgt-warn) 8%, var(--dgt-card));flex:0 0 auto;}
.dgt-conflict-count{font-size:11px;font-weight:600;border-radius:999px;padding:2px 9px;
  background:color-mix(in srgb, var(--dgt-warn) 16%, transparent);color:var(--dgt-warn);}
.dgt-conflict-count[data-tone='ok']{background:color-mix(in srgb, var(--dgt-ok) 16%, transparent);color:var(--dgt-ok);}
.dgt-conflict-meta{font-size:10.5px;color:var(--dsw-alias-label-tertiary);}
.dgt-cfline{display:grid;grid-template-columns:52px 1fr;align-items:baseline;min-height:19px;
  font:12px/19px var(--ds-font-family-code);white-space:pre-wrap;overflow-wrap:anywhere;}
.dgt-cfline-no{font-size:10px;color:var(--dsw-alias-label-caption);text-align:right;padding-right:10px;
  border-right:1px solid var(--dgt-line-soft);user-select:none;}
.dgt-cfline-text{padding:0 12px;color:var(--dsw-alias-label-primary);}
.dgt-cfline[data-kind='ours']{background:color-mix(in srgb, var(--dgt-accent) 10%, transparent);}
.dgt-cfline[data-kind='theirs']{background:color-mix(in srgb, var(--dgt-warn) 12%, transparent);}
.dgt-cfline[data-kind='base']{background:color-mix(in srgb, var(--dsw-alias-label-tertiary) 10%, transparent);}
.dgt-cfline[data-kind='marker-start'],
.dgt-cfline[data-kind='marker-sep'],
.dgt-cfline[data-kind='marker-end'],
.dgt-cfline[data-kind='marker-base']{background:color-mix(in srgb, var(--dgt-warn) 22%, var(--dgt-card));
  color:var(--dgt-warn);font-weight:600;}
.dgt-cfline[data-kind='marker-start'] .dgt-cfline-text,
.dgt-cfline[data-kind='marker-sep'] .dgt-cfline-text,
.dgt-cfline[data-kind='marker-end'] .dgt-cfline-text,
.dgt-cfline[data-kind='marker-base'] .dgt-cfline-text{color:var(--dgt-warn);}
.dgt-conflict-actions{display:flex;align-items:center;gap:6px;margin-left:auto;}
.dgt-diff-action[data-kind='ai']{border-color:color-mix(in srgb, var(--dgt-accent) 40%, var(--dgt-line));
  background:var(--dgt-accent-soft);color:var(--dgt-accent-strong);}
.dgt-diff-action[data-kind='ai']:disabled{opacity:.55;}
.dgt-diff-action[data-kind='ghost']{background:transparent;color:var(--dsw-alias-label-secondary);}
/* Resolution preview dialog */
.dgt-dialog.dgt-conflict-dialog{box-sizing:border-box;width:min(880px,92vw);max-height:86vh;}
.dgt-conflict-dialog-meta{display:flex;align-items:center;gap:12px;min-width:0;}
.dgt-conflict-dialog-model{font-size:10.5px;color:var(--dsw-alias-label-tertiary);
  padding:2px 8px;border-radius:999px;background:var(--dgt-line-soft);}
.dgt-conflict-dialog-body{margin-top:2px;max-height:56vh;overflow:auto;border:1px solid var(--dgt-line);
  border-radius:10px;background:var(--dgt-page);scrollbar-width:thin;}
.dgt-conflict-dialog-body .dgt-file-block{min-width:max-content;}
.dgt-conflict-dialog-text{margin:0;padding:12px 14px;font:12px/19px var(--ds-font-family-code);
  color:var(--dsw-alias-label-primary);white-space:pre-wrap;overflow-wrap:anywhere;}

/* AI commit message: one quiet action plus the model chip it calls */
.dgt-ai{position:relative;display:flex;align-items:center;gap:4px;}
.dgt-ai-generate{appearance:none;display:inline-flex;align-items:center;gap:4px;height:23px;padding:0 9px;
  border:1px solid color-mix(in srgb, var(--dgt-accent) 22%, var(--dgt-line));border-radius:8px;
  background:var(--dgt-accent-soft);color:var(--dgt-accent-strong);
  font:inherit;font-size:10.5px;font-weight:500;cursor:pointer;white-space:nowrap;}
.dgt-ai-generate svg{width:11px;height:11px;flex:0 0 auto;}
.dgt-ai-generate:hover:not(:disabled){border-color:color-mix(in srgb, var(--dgt-accent) 40%, var(--dgt-line));}
.dgt-ai-generate:disabled{border-color:var(--dgt-line);background:transparent;color:var(--dsw-alias-label-caption);
  cursor:default;}
.dgt-ai-generate[data-busy='true'] svg{animation:dgt-spin 1.4s linear infinite;}
.dgt-ai-chip{appearance:none;display:inline-flex;align-items:center;gap:4px;max-width:220px;height:23px;
  padding:0 7px;border:1px solid var(--dgt-line);border-radius:8px;background:transparent;
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:10.5px;cursor:pointer;}
.dgt-ai-chip:hover{background:var(--dgt-line-soft);color:var(--dsw-alias-label-primary);}
.dgt-ai-chip-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dgt-ai-caret{font-size:9px;line-height:1;color:var(--dsw-alias-label-tertiary);}
.dgt-ai-menu{position:absolute;right:0;bottom:calc(100% + 8px);z-index:45;width:min(360px,64vw);
  max-height:min(340px,52vh);overflow:auto;padding:6px;border:1px solid var(--dgt-line);border-radius:12px;
  background:var(--dgt-card);box-shadow:0 14px 34px var(--dsw-alias-bg-mask-1);scrollbar-width:thin;}
/* The menu is viewport-fixed (see CommitBox): the fold row clips the card body,
   and a clipped dropdown reads as a broken control. */
.dgt-ai-menu[data-floating='true']{position:fixed;right:auto;bottom:auto;z-index:90;
  max-height:min(360px,50vh);}
.dgt-ai-menu-head{padding:4px 8px 6px;border-bottom:1px solid var(--dgt-line-soft);margin-bottom:4px;
  color:var(--dsw-alias-label-tertiary);font-size:10.5px;}
.dgt-ai-menu-empty{padding:8px;color:var(--dsw-alias-label-tertiary);font-size:11.5px;}
.dgt-ai-group{padding:2px 0;}
.dgt-ai-group-title{padding:4px 8px 3px;color:var(--dsw-alias-label-tertiary);font-size:10px;
  text-transform:none;letter-spacing:.02em;}
.dgt-ai-option{display:flex;align-items:center;gap:7px;width:100%;padding:5px 8px;border:0;border-radius:7px;
  background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;text-align:left;cursor:pointer;}
.dgt-ai-option:hover{background:var(--dgt-accent-soft);}
.dgt-ai-option[data-current]{background:var(--dgt-accent-soft);}
.dgt-ai-option-check{width:12px;flex:0 0 auto;color:var(--dgt-accent-strong);font-size:10.5px;}
.dgt-ai-option-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dgt-ai-option-id{flex:0 0 auto;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  color:var(--dsw-alias-label-tertiary);font-size:10px;}
.dgt-ai-menu-failure{padding:6px 8px 2px;border-top:1px solid var(--dgt-line-soft);margin-top:4px;
  color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:15px;}
.dgt-commit-foot{display:flex;align-items:center;gap:10px;}
.dgt-hint{flex:1 1 auto;min-width:0;color:var(--dsw-alias-label-tertiary);font-size:10.5px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dgt-hint[data-tone='error']{color:var(--dgt-err);}
.dgt-primary{appearance:none;height:31px;padding:0 16px;border:1px solid transparent;border-radius:9px;
  background:var(--dgt-accent-strong);color:var(--dsw-alias-label-primary-inverted);
  font:inherit;font-size:12px;font-weight:500;cursor:pointer;box-shadow:0 3px 10px color-mix(in srgb, var(--dgt-accent) 28%, transparent);}
.dgt-primary:hover:not(:disabled){opacity:.94;}
.dgt-primary:disabled{background:var(--dgt-accent-strong);color:var(--dsw-alias-label-primary-inverted);
  opacity:.45;box-shadow:none;cursor:default;}
.dgt-button,.dgt-clear{appearance:none;height:31px;padding:0 14px;border:1px solid var(--dgt-line);
  border-radius:9px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;}
.dgt-button:hover,.dgt-clear:hover{background:var(--dgt-line-soft);color:var(--dsw-alias-label-primary);}
.dgt-clear{height:31px;padding:0 14px;}

/* banners, menus, dialogs, toast */
.dgt-banner{display:flex;flex-direction:column;gap:2px;flex:0 0 auto;padding:8px 12px;
  border:1px solid var(--dgt-line);border-radius:10px;background:var(--dgt-card);
  color:var(--dsw-alias-label-secondary);font-size:11.5px;}
.dgt-banner[data-tone='error']{color:var(--dgt-err);}
.dgt-banner-text{min-width:0;}
.dgt-menu{position:absolute;right:6px;top:24px;z-index:5;min-width:150px;padding:5px;
  border:1px solid var(--dgt-line);border-radius:10px;background:var(--dgt-card);
  box-shadow:0 10px 26px var(--dsw-alias-bg-mask-1);}
.dgt-menu button{display:block;width:100%;padding:5px 9px;border:0;border-radius:7px;background:transparent;
  color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;text-align:left;cursor:pointer;}
.dgt-menu button:hover{background:var(--dgt-line-soft);}
.dgt-menu button:disabled{color:var(--dsw-alias-label-caption);cursor:default;}
.dgt-ctxmenu{position:fixed;z-index:80;min-width:200px;max-width:280px;padding:6px;
  border:1px solid var(--dgt-line);border-radius:12px;background:var(--dgt-card);
  box-shadow:0 12px 30px var(--dsw-alias-bg-mask-1);}
.dgt-ctxmenu-title{padding:5px 9px 7px;margin-bottom:4px;border-bottom:1px solid var(--dgt-line-soft);
  font-size:10.5px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dgt-ctxmenu-item{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;
  height:30px;padding:0 9px;border:0;border-radius:8px;background:transparent;
  color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;text-align:left;cursor:pointer;}
.dgt-ctxmenu-item:hover:not(:disabled){background:var(--dgt-accent-soft);}
.dgt-ctxmenu-item:disabled{color:var(--dsw-alias-label-caption);cursor:default;}
.dgt-ctxmenu-item[data-danger='true']:not(:disabled){color:var(--dgt-err);}
.dgt-ctxmenu-item kbd{font:10.5px var(--ds-font-family-code);color:var(--dsw-alias-label-tertiary);}
.dgt-ctxmenu-divider{height:1px;margin:5px 3px;background:var(--dgt-line-soft);}
.dgt-overlay{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
  background:var(--dsw-alias-bg-mask-1);}
.dgt-dialog{width:340px;max-width:88vw;display:flex;flex-direction:column;gap:9px;padding:16px;
  border:1px solid var(--dgt-line);border-radius:14px;background:var(--dgt-card);
  box-shadow:0 18px 44px var(--dsw-alias-bg-mask-1);}
.dgt-dialog-title{font-size:13.5px;font-weight:600;}
.dgt-dialog-label{font-size:11px;color:var(--dsw-alias-label-secondary);}
.dgt-dialog-body{font-size:12px;line-height:19px;color:var(--dsw-alias-label-secondary);}
.dgt-dialog-input{height:30px;padding:0 9px;border:1px solid var(--dgt-line);border-radius:8px;
  background:var(--dgt-page);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;}
.dgt-dialog-input:focus{outline:none;border-color:var(--dgt-accent);}
.dgt-dialog-error{font-size:11px;color:var(--dgt-err);}
.dgt-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:5px;}
.dgt-danger{background:var(--dgt-err);color:var(--dsw-alias-label-primary-inverted);box-shadow:none;}
.dgt-toast{position:absolute;right:20px;bottom:132px;z-index:70;max-width:60%;padding:8px 12px;
  border:1px solid var(--dgt-line);border-radius:10px;background:var(--dgt-card);
  color:var(--dsw-alias-label-primary);font-size:12px;box-shadow:0 8px 24px var(--dsw-alias-bg-mask-1);}
`
