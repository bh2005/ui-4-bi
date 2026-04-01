// ── Node / Aggregator-Typen ───────────────────────────────────────────────
export const aggregatorTypes = [
  { value: 'and',        label: 'AND (alle müssen OK sein)' },
  { value: 'or',         label: 'OR (mindestens einer OK)'  },
  { value: 'best',       label: 'Best state'                },
  { value: 'worst',      label: 'Worst state'               },
  { value: 'best_of_n',  label: 'Best of N'                 },
  { value: 'worst_of_n', label: 'Worst of N'                },
];

export const nodeTypes = [
  { type: 'aggregator',  label: 'BI Aggregator',   color: '#13d38e', icon: 'git-merge'   },
  { type: 'host',        label: 'Host (Process)',  color: '#A5D6A7', icon: 'server'       },
  { type: 'service',     label: 'Service',         color: '#90A4AE', icon: 'activity'     },
  { type: 'hostgroup',   label: 'Host-Gruppe',     color: '#66BB6A', icon: 'layers'       },
  { type: 'servicegroup',label: 'Service-Gruppe',  color: '#78909C', icon: 'list-checks'  },
  { type: 'bi',          label: 'Andere BI',       color: '#9C7DFF', icon: 'share-2'      },
];

// ── Layout-Konstanten ─────────────────────────────────────────────────────
export const LAYOUT = {
  NODE_W: 160,
  NODE_H: 70,
  GAP_X:  60,
  GAP_Y:  80,
  MARGIN: 60,
};

// ── Snap ──────────────────────────────────────────────────────────────────
export const SNAP_GRID = 20;
export const SNAP_TOL  = 8;
