/**
 * Tests für js/utils/cmk-bi-converter.js
 *   - exportToCMK: Struktur, Regelanzahl, Aggregationen, Params
 *   - importFromCMK: Node-Typen, Kanten, Bidirektionalität
 */
import { describe, it, expect } from 'vitest';
import { exportToCMK, importFromCMK } from '../../src/js/utils/cmk-bi-converter.js';

// ── Fixtures ──────────────────────────────────────────────────────────────

const HOST_NODE    = { id: 1, type: 'host',    label: 'web-01',   x:0, y:0, color:'#A5D6A7', meta: { hostSvc: 'web-01' } };
const SERVICE_NODE = { id: 2, type: 'service', label: 'HTTP',     x:0, y:0, color:'#90A4AE', meta: { hostSvc: 'HTTP'   } };
const AGG_NODE     = { id: 3, type: 'aggregator', label: 'Frontend', x:0, y:0, color:'#13d38e', aggType: 'worst' };
const AGG_ROOT     = { id: 4, type: 'aggregator', label: 'Root',     x:0, y:0, color:'#13d38e', aggType: 'best'  };

// Einfacher Graph: Host → Agg (Root)
const simpleGraph = {
  nodes: [HOST_NODE, AGG_ROOT],
  edges: [{ id:'e1', from: 1, to: 4, routing:'straight' }],
};

// Zweistufig: Host/Service → AGG_NODE → AGG_ROOT
const twoLevelGraph = {
  nodes: [HOST_NODE, SERVICE_NODE, AGG_NODE, AGG_ROOT],
  edges: [
    { id:'e1', from: 1, to: 3 },
    { id:'e2', from: 2, to: 3 },
    { id:'e3', from: 3, to: 4 },
  ],
};


// ── exportToCMK ───────────────────────────────────────────────────────────

describe('exportToCMK – Grundstruktur', () => {
  it('gibt Pack mit id, title, rules, aggregations zurück', () => {
    const pack = exportToCMK(simpleGraph, 'test_pack', 'Test Pack');
    expect(pack.id).toBe('test_pack');
    expect(pack.title).toBe('Test Pack');
    expect(Array.isArray(pack.rules)).toBe(true);
    expect(Array.isArray(pack.aggregations)).toBe(true);
  });

  it('erzeugt eine Regel pro Aggregator-Node', () => {
    const pack = exportToCMK(simpleGraph);
    expect(pack.rules).toHaveLength(1);
  });

  it('erzeugt eine Aggregation für Root-Aggregatoren', () => {
    const pack = exportToCMK(simpleGraph);
    expect(pack.aggregations).toHaveLength(1);
    expect(pack.aggregations[0].node.action.type).toBe('call_a_rule');
  });

  it('zweistufig: zwei Regeln, eine Aggregation', () => {
    const pack = exportToCMK(twoLevelGraph);
    expect(pack.rules).toHaveLength(2);
    expect(pack.aggregations).toHaveLength(1);
  });
});

describe('exportToCMK – Node-Mapping', () => {
  it('Host → state_of_host', () => {
    const pack = exportToCMK(simpleGraph);
    const rule = pack.rules[0];
    const hostGen = rule.nodes.find(n => n.action.type === 'state_of_host');
    expect(hostGen).toBeDefined();
    expect(hostGen.action.host_regex).toBe('web-01');
  });

  it('Service → state_of_service', () => {
    const pack = exportToCMK(twoLevelGraph);
    const rule = pack.rules.find(r => r.id === `rule_${AGG_NODE.id}`);
    const svcGen = rule.nodes.find(n => n.action.type === 'state_of_service');
    expect(svcGen).toBeDefined();
    expect(svcGen.action.service_regex).toBe('HTTP');
  });

  it('Sub-Aggregator → call_a_rule', () => {
    const pack = exportToCMK(twoLevelGraph);
    const rootRule = pack.rules.find(r => r.id === `rule_${AGG_ROOT.id}`);
    const callGen  = rootRule.nodes.find(n => n.action.type === 'call_a_rule');
    expect(callGen).toBeDefined();
    expect(callGen.action.rule_id).toBe(`rule_${AGG_NODE.id}`);
  });
});

describe('exportToCMK – Aggregations-Funktionen', () => {
  it.each([
    ['worst',      { type: 'worst' }],
    ['best',       { type: 'best'  }],
    ['and',        { type: 'worst' }],
    ['or',         { type: 'best'  }],
    ['best_of_n',  { type: 'count_ok' }],
  ])('aggType=%s → CMK type=%s', (aggType, expected) => {
    const graph = {
      nodes: [
        { id: 1, type: 'host', label: 'h1', x:0, y:0 },
        { id: 2, type: 'aggregator', label: 'A', x:0, y:0, aggType },
      ],
      edges: [{ id:'e1', from:1, to:2 }],
    };
    const pack = exportToCMK(graph);
    expect(pack.rules[0].aggregation_function.type).toBe(expected.type);
  });
});

describe('exportToCMK – Parametrisierte Regeln', () => {
  it('extrahiert $VAR$-Variablen aus Labels', () => {
    const graph = {
      nodes: [
        { id: 1, type: 'host', label: '$HOSTNAME$', x:0, y:0 },
        { id: 2, type: 'aggregator', label: 'Agg-$HOSTNAME$', x:0, y:0, aggType: 'worst' },
      ],
      edges: [{ id:'e1', from:1, to:2 }],
    };
    const pack = exportToCMK(graph);
    expect(pack.rules[0].params.arguments).toContain('HOSTNAME');
  });

  it('keine doppelten Variablen', () => {
    const graph = {
      nodes: [
        { id: 1, type: 'host',       label: '$HOST$', x:0, y:0 },
        { id: 2, type: 'service',    label: '$HOST$', x:0, y:0 },
        { id: 3, type: 'aggregator', label: '$HOST$', x:0, y:0, aggType: 'worst' },
      ],
      edges: [{ id:'e1', from:1, to:3 }, { id:'e2', from:2, to:3 }],
    };
    const pack = exportToCMK(graph);
    expect(pack.rules[0].params.arguments.filter(v => v === 'HOST')).toHaveLength(1);
  });
});


// ── importFromCMK ─────────────────────────────────────────────────────────

const SAMPLE_PACK = {
  id: 'sample', title: 'Sample',
  rules: [
    {
      id: 'rule_web',
      properties: { title: 'Web Frontend' },
      aggregation_function: { type: 'worst', count: 1 },
      params: { arguments: [] },
      nodes: [
        { search: { type: 'empty' }, action: { type: 'state_of_host', host_regex: 'web-01' } },
        { search: { type: 'empty' }, action: { type: 'state_of_service', service_regex: 'HTTP' } },
      ],
    },
  ],
  aggregations: [],
};

describe('importFromCMK – Grundstruktur', () => {
  it('gibt nodes, edges, nextId zurück', () => {
    const result = importFromCMK(SAMPLE_PACK);
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);
    expect(typeof result.nextId).toBe('number');
  });

  it('erzeugt einen Aggregator-Node pro Regel', () => {
    const result = importFromCMK(SAMPLE_PACK);
    const aggs = result.nodes.filter(n => n.type === 'aggregator');
    expect(aggs).toHaveLength(1);
    expect(aggs[0].label).toBe('Web Frontend');
  });

  it('erzeugt Host-Node für state_of_host', () => {
    const result = importFromCMK(SAMPLE_PACK);
    const hosts = result.nodes.filter(n => n.type === 'host');
    expect(hosts).toHaveLength(1);
    expect(hosts[0].meta.hostSvc).toBe('web-01');
  });

  it('erzeugt Service-Node für state_of_service', () => {
    const result = importFromCMK(SAMPLE_PACK);
    const svcs = result.nodes.filter(n => n.type === 'service');
    expect(svcs).toHaveLength(1);
  });

  it('Kanten zeigen von Kind zu Aggregator', () => {
    const result = importFromCMK(SAMPLE_PACK);
    const aggId = result.nodes.find(n => n.type === 'aggregator').id;
    result.edges.forEach(e => {
      expect(e.to).toBe(aggId);
    });
  });
});

describe('importFromCMK – Host/Service-Gruppen', () => {
  it('host_search → hostgroup-Node', () => {
    const pack = {
      id: 'p', rules: [{
        id: 'r1', properties: { title: 'R' },
        aggregation_function: { type: 'worst', count: 1 },
        params: { arguments: [] },
        nodes: [{
          search: {
            type: 'host_search',
            conditions: { host_choice: { type: 'host_name_regex', pattern: 'web-.*' } },
          },
          action: { type: 'call_a_rule', rule_id: 'r1', params: { arguments: [] } },
        }],
      }],
      aggregations: [],
    };
    const result = importFromCMK(pack);
    const hg = result.nodes.find(n => n.type === 'hostgroup');
    expect(hg).toBeDefined();
    expect(hg.meta.hostSvc).toBe('web-.*');
  });
});

describe('importFromCMK – Aggregations-Typ', () => {
  it.each([
    [{ type: 'worst', count: 1 }, 'worst'],
    [{ type: 'best',  count: 1 }, 'best'],
    [{ type: 'count_ok', levels_ok: {} }, 'best_of_n'],
    [null, 'worst'],
  ])('CMK %j → lokal %s', (fn, expected) => {
    const pack = {
      id: 'p', rules: [{
        id: 'r1', properties: { title: 'T' },
        aggregation_function: fn,
        params: { arguments: [] },
        nodes: [],
      }],
      aggregations: [],
    };
    const result = importFromCMK(pack);
    expect(result.nodes[0].aggType).toBe(expected);
  });
});

describe('importFromCMK – Leeres Pack', () => {
  it('leeres Pack ergibt leere Arrays', () => {
    const result = importFromCMK({ id: 'empty', rules: [], aggregations: [] });
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.nextId).toBe(1);
  });
});
