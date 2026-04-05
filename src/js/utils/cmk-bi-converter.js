/**
 * Checkmk BI Pack – Import / Export
 *
 * Kantenrichtung in ui-4-bi:
 *   edge.from = Kind (Status-Quelle)  →  edge.to = Eltern-Aggregator (Status-Senke)
 *
 * Das entspricht dem Checkmk-BI-Datenfluss:
 *   Host/Service → liefert Status → Aggregator-Regel
 */

// ── Export: ui-4-bi Graph → Checkmk BI Pack JSON ─────────────────────────
export function exportToCMK(graphState, packId, packTitle) {
  const pid           = packId    || graphState.pack?.id    || 'default';
  const ptt           = packTitle || graphState.pack?.title || 'UI4BI Export';
  const contactGroups = graphState.pack?.contactGroups || [];
  // childrenOf[nodeId] = IDs aller Knoten, deren Status in nodeId einfließt
  const childrenOf = {};
  graphState.nodes.forEach(n => { childrenOf[n.id] = []; });
  graphState.edges.forEach(e => {
    if (!childrenOf[e.to]) childrenOf[e.to] = [];
    childrenOf[e.to].push(e.from);
  });

  // Root-Aggregatoren = Aggregatoren, die selbst in keinen anderen fließen
  const nodesWithOutgoing = new Set(graphState.edges.map(e => e.from));

  const rules        = [];
  const aggregations = [];

  graphState.nodes.filter(n => n.type === 'aggregator').forEach(agg => {
    const children  = (childrenOf[agg.id] || [])
      .map(cid => graphState.nodes.find(n => n.id === cid))
      .filter(Boolean);

    // Params: explizit gesetzte Parameter + aus Labels/hostSvc extrahierte $VAR$-Variablen
    const explicitParams = agg.params || [];
    const implicitParams = _extractVars([agg.label, ...children.map(c => c.meta?.hostSvc || c.label)]);
    const allParams = [...new Set([...explicitParams, ...implicitParams])];

    rules.push({
      id:      `rule_${agg.id}`,
      pack_id: pid,
      nodes:   children.map(c => _childToNodeGen(c, allParams)),
      params:  { arguments: allParams },
      properties: {
        title:          agg.label,
        comment:        '',
        icon:           '',
        docu_url:       '',
        state_messages: {},
      },
      aggregation_function: _aggFn(agg.aggType),
      computation_options:  { disabled: false, use_hard_states: false, escalate_downtimes_as_warn: false },
      node_visualization:   { type: 'none', style_config: {} },
    });

    // Root-Aggregator → zusätzlich Aggregation-Eintrag erzeugen
    if (!nodesWithOutgoing.has(agg.id)) {
      aggregations.push({
        id:       `agg_${agg.id}`,
        comment:  agg.label,
        customer: null,
        groups:   { names: ['Main'], paths: [] },
        node: {
          search: { type: 'empty' },
          action: { type: 'call_a_rule', rule_id: `rule_${agg.id}`, params: { arguments: allParams.map(p => `$${p}$`) } },
        },
        aggregation_visualization: {
          layout_id:           'builtin_default',
          line_style:          'round',
          ignore_rule_styles:  false,
        },
        computation_options: { disabled: false, use_hard_states: false, escalate_downtimes_as_warn: false },
      });
    }
  });

  return {
    id:             pid,
    title:          ptt,
    comment:        'Exported from UI4BI',
    contact_groups: contactGroups,
    public:         true,
    rules,
    aggregations,
  };
}

/** Extrahiert $VAR$-Bezeichner aus einem Array von Strings */
function _extractVars(strings) {
  const vars = new Set();
  for (const s of strings) {
    if (!s) continue;
    for (const m of String(s).matchAll(/\$([A-Z0-9_]+)\$/g)) vars.add(m[1]);
  }
  return [...vars];
}

function _childToNodeGen(node, parentParams = []) {
  switch (node.type) {
    case 'host':
      return {
        search: { type: 'empty' },
        action: { type: 'state_of_host', host_regex: node.meta?.hostSvc || node.label },
      };
    case 'service':
      return {
        search: { type: 'empty' },
        action: {
          type:          'state_of_service',
          host_regex:    '.*',
          service_regex: node.meta?.hostSvc || node.label,
        },
      };
    case 'hostgroup':
      return {
        search: {
          type: 'host_search',
          conditions: {
            host_folder:      '',
            host_choice:      { type: 'host_name_regex', pattern: node.meta?.hostSvc || '.*' },
            host_tags:        {},
            host_label_groups:[],
          },
          refer_to: 'host',
        },
        action: { type: 'call_a_rule', rule_id: `rule_${node.id}`, params: { arguments: [] } },
      };
    case 'servicegroup':
      return {
        search: {
          type: 'service_search',
          conditions: {
            host_folder:         '',
            host_choice:         { type: 'all_hosts' },
            host_tags:           {},
            host_label_groups:   [],
            service_label_groups:[],
          },
          refer_to: 'service',
        },
        action: { type: 'call_a_rule', rule_id: `rule_${node.id}`, params: { arguments: [] } },
      };
    case 'aggregator': {
      const childParams = (node.params || []);
      const passArgs = childParams.length
        ? childParams.map(p => `$${p}$`)
        : parentParams.map(p => `$${p}$`);
      return {
        search: { type: 'empty' },
        action: { type: 'call_a_rule', rule_id: `rule_${node.id}`, params: { arguments: passArgs } },
      };
    }
    case 'bi':
      return {
        search: { type: 'empty' },
        action: { type: 'call_a_rule', rule_id: node.meta?.biRef || node.label,
          params: { arguments: parentParams.map(p => `$${p}$`) } },
      };
    case 'hostregex':
      return {
        search: {
          type: 'host_search',
          conditions: {
            host_folder:       '',
            host_choice:       { type: 'host_name_regex', pattern: node.meta?.hostRegex || '.*' },
            host_tags:         {},
            host_label_groups: [],
          },
          refer_to: 'host',
        },
        action: { type: 'state_of_host', host_regex: node.meta?.hostRegex || '.*' },
      };
    case 'serviceregex':
      return {
        search: {
          type: 'service_search',
          conditions: {
            host_folder:          '',
            host_choice:          { type: 'host_name_regex', pattern: node.meta?.hostRegex || '.*' },
            host_tags:            {},
            host_label_groups:    [],
            service_label_groups: [],
            service_regex:        node.meta?.serviceRegex || '.*',
          },
          refer_to: 'service',
        },
        action: {
          type:          'state_of_service',
          host_regex:    node.meta?.hostRegex    || '.*',
          service_regex: node.meta?.serviceRegex || '.*',
        },
      };
    default:
      return {
        search: { type: 'empty' },
        action: { type: 'state_of_host', host_regex: node.label },
      };
  }
}

function _aggFn(aggType) {
  const map = {
    and:        { type: 'worst', count: 1, restrict_state: 2 },
    or:         { type: 'best',  count: 1, restrict_state: 2 },
    best:       { type: 'best',  count: 1, restrict_state: 2 },
    worst:      { type: 'worst', count: 1, restrict_state: 2 },
    best_of_n:  { type: 'count_ok', levels_ok: { type: 'count', value: 2 }, levels_warn: { type: 'count', value: 1 } },
    worst_of_n: { type: 'worst', count: 2, restrict_state: 2 },
  };
  return map[aggType] || map.worst;
}


// ── Import: Checkmk BI Pack JSON → ui-4-bi Graph ──────────────────────────
export function importFromCMK(pack) {
  const nodes = [];
  const edges = [];
  let nextId  = 1;
  let edgeSeq = 1;

  const ruleToNodeId = {}; // rule.id → graph-node.id

  // Pass 1: Aggregator-Node für jede Regel anlegen
  for (const rule of (pack.rules || [])) {
    const nodeId = nextId++;
    ruleToNodeId[rule.id] = nodeId;
    const rawParams = rule.params?.arguments || [];
    // CMK speichert Params als ['HOSTNAME'] oder ['$HOSTNAME$'] — normalisieren
    const cleanParams = rawParams.map(p => p.replace(/\$/g, '').toUpperCase()).filter(Boolean);
    nodes.push({
      id:      nodeId,
      type:    'aggregator',
      label:   rule.properties?.title || rule.id,
      x: 0, y: 0,
      color:   '#13d38e',
      icon:    'git-merge',
      aggType: _localAggType(rule.aggregation_function),
      params:  cleanParams.length ? cleanParams : undefined,
    });
  }

  // Pass 2: Kind-Nodes + Kanten aus den Regel-Node-Generatoren
  for (const rule of (pack.rules || [])) {
    const parentId = ruleToNodeId[rule.id];

    for (const gen of (rule.nodes || [])) {
      const { search, action } = gen;
      let childId = null;

      if (action?.type === 'call_a_rule') {
        if (ruleToNodeId[action.rule_id] !== undefined) {
          // Interne Regel-Referenz → Kante von Sub-Aggregator zu Eltern
          childId = ruleToNodeId[action.rule_id];
          edges.push(_edge(edgeSeq++, childId, parentId));
          childId = null;
        } else {
          // Externe BI-Referenz
          childId = nextId++;
          nodes.push({ id: childId, type: 'bi', label: action.rule_id, x: 0, y: 0,
            color: '#9C7DFF', icon: 'share-2', meta: { biRef: action.rule_id } });
        }
      } else if (action?.type === 'state_of_host') {
        childId = nextId++;
        nodes.push({ id: childId, type: 'host', label: action.host_regex || 'Host', x: 0, y: 0,
          color: '#A5D6A7', icon: 'server', meta: { hostSvc: action.host_regex } });
      } else if (action?.type === 'state_of_service') {
        childId = nextId++;
        nodes.push({ id: childId, type: 'service', label: action.service_regex || 'Service', x: 0, y: 0,
          color: '#90A4AE', icon: 'activity', meta: { hostSvc: action.service_regex } });
      } else if (action?.type === 'state_of_remaining_services') {
        childId = nextId++;
        nodes.push({ id: childId, type: 'service', label: `${action.host_regex} (remaining)`, x: 0, y: 0,
          color: '#90A4AE', icon: 'activity', meta: { hostSvc: action.host_regex } });
      } else if (search?.type === 'host_search') {
        childId = nextId++;
        const pattern = search.conditions?.host_choice?.pattern || '';
        if (action?.type === 'state_of_host') {
          // Dynamische Host-Regex (kein call_a_rule → hostregex-Typ)
          nodes.push({ id: childId, type: 'hostregex', label: pattern || 'Host-Regex', x: 0, y: 0,
            color: '#81C784', icon: 'search', meta: { hostRegex: action.host_regex || pattern } });
        } else {
          nodes.push({ id: childId, type: 'hostgroup', label: pattern || 'Host-Gruppe', x: 0, y: 0,
            color: '#66BB6A', icon: 'layers', meta: { hostSvc: pattern } });
        }
      } else if (search?.type === 'service_search') {
        childId = nextId++;
        const hostPat = search.conditions?.host_choice?.pattern || '';
        const svcPat  = search.conditions?.service_regex || '';
        if (action?.type === 'state_of_service') {
          nodes.push({ id: childId, type: 'serviceregex', label: svcPat || 'Service-Regex', x: 0, y: 0,
            color: '#B0BEC5', icon: 'file-search',
            meta: { hostRegex: action.host_regex || hostPat, serviceRegex: action.service_regex || svcPat } });
        } else {
          nodes.push({ id: childId, type: 'servicegroup', label: svcPat || 'Service-Gruppe', x: 0, y: 0,
            color: '#78909C', icon: 'list-checks' });
        }
      }

      if (childId !== null) {
        edges.push(_edge(edgeSeq++, childId, parentId));
      }
    }
  }

  const packMeta = {
    id:            pack.id    || 'default',
    title:         pack.title || '',
    contactGroups: pack.contact_groups || [],
  };
  return { nodes, edges, nextId, packMeta };
}

function _edge(seq, from, to) {
  return { id: `e_cmk_${seq}`, from, to, routing: 'straight', arrowStyle: 'none', arrowSize: 'sm' };
}

function _localAggType(fn) {
  if (!fn) return 'worst';
  if (fn.type === 'best')     return fn.count > 1 ? 'best_of_n' : 'best';
  if (fn.type === 'worst')    return fn.count > 1 ? 'worst_of_n' : 'worst';
  if (fn.type === 'count_ok') return 'best_of_n';
  return 'worst';
}
