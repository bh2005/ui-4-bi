// mock-backend.js – angepasst an dunklen NagVis-Style mit Status-Farben
// Verwendet localStorage für Persistenz (POC)

const MockBackend = (function () {
  const STORAGE_KEY = 'ui4bi_rules_v2026';

  function _loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initialData = { rules: [createDemoRule()], lastId: 1 };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
      return initialData;
    }
    return JSON.parse(raw);
  }

  function _saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function createDemoRule() {
    return {
      id: 'rule-001',
      title: 'Kritischer Zahlungsfluss',
      description: 'Überwachung der wichtigsten Zahlungskomponenten (POC Demo)',
      active: true,
      version: 1,
      created_at: new Date().toISOString(),
      created_by: 'demo-user',
      nodes: [
        {
          id: 'n-host-payment',
          label: 'Payment Gateway',
          selector: 'host:payment-gw-prod',
          type: 'host',
          x: 180,
          y: 120,
          w: 180,
          h: 64,
          status: 'ok',
          color: '',
          aggregation: 'worst'
        },
        {
          id: 'n-svc-visa',
          label: 'Visa Processor',
          selector: 'host:payment-gw-prod::visa',
          type: 'service',
          x: 480,
          y: 80,
          w: 160,
          h: 56,
          status: 'warning',
          color: '',
          aggregation: 'majority'
        },
        {
          id: 'n-svc-mastercard',
          label: 'Mastercard Processor',
          selector: 'host:payment-gw-prod::mastercard',
          type: 'service',
          x: 480,
          y: 180,
          w: 160,
          h: 56,
          status: 'ok',
          color: '',
          aggregation: 'majority'
        },
        {
          id: 'n-db',
          label: 'Payment Database',
          selector: 'host:db-prod::mysql_payments',
          type: 'service',
          x: 820,
          y: 140,
          w: 160,
          h: 56,
          status: 'critical',
          color: '',
          aggregation: 'worst'
        },
        {
          id: 'n-cache',
          label: 'Redis Cache',
          selector: 'host:cache-prod::redis_6379',
          type: 'service',
          x: 820,
          y: 260,
          w: 140,
          h: 56,
          status: 'downtime',
          color: '',
          aggregation: 'any'
        }
      ],
      edges: [
        {
          id: 'e1',
          sourceId: 'n-host-payment',
          targetId: 'n-svc-visa',
          waypoints: [],
          operator: 'DEPENDS_ON'
        },
        {
          id: 'e2',
          sourceId: 'n-host-payment',
          targetId: 'n-svc-mastercard',
          waypoints: [],
          operator: 'DEPENDS_ON'
        },
        {
          id: 'e3',
          sourceId: 'n-svc-visa',
          targetId: 'n-db',
          waypoints: [{ x: 620, y: 100 }],
          operator: 'REQUIRES'
        },
        {
          id: 'e4',
          sourceId: 'n-svc-mastercard',
          targetId: 'n-db',
          waypoints: [{ x: 620, y: 200 }],
          operator: 'REQUIRES'
        },
        {
          id: 'e5',
          sourceId: 'n-db',
          targetId: 'n-cache',
          waypoints: [],
          operator: 'AFFECTS'
        }
      ],
      ui_meta: {
        zoom: 1,
        panX: 0,
        panY: 0,
        lastEdited: new Date().toISOString()
      }
    };
  }

  return {
    listRules: async () => _loadData().rules,

    getRule: async id => _loadData().rules.find(r => r.id === id) || null,

    createOrUpdateRule: async rule => {
      const data = _loadData();
      const idx = data.rules.findIndex(r => r.id === rule.id);
      if (idx >= 0) {
        rule.version = (data.rules[idx].version || 1) + 1;
        rule.lastEdited = new Date().toISOString();
        data.rules[idx] = rule;
      } else {
        rule.id = rule.id || `rule-${String(data.lastId || 1).padStart(3, '0')}`;
        rule.version = 1;
        rule.created_at = new Date().toISOString();
        data.rules.push(rule);
        data.lastId = (data.lastId || 1) + 1;
      }
      _saveData(data);
      return rule;
    },

    deleteRule: async id => {
      const data = _loadData();
      const before = data.rules.length;
      data.rules = data.rules.filter(r => r.id !== id);
      _saveData(data);
      return data.rules.length < before;
    },

    createEmptyRule: title => ({
      id: null,
      title: title || 'Neue Regel',
      description: '',
      active: true,
      version: 1,
      created_at: new Date().toISOString(),
      nodes: [],
      edges: [],
      ui_meta: {}
    })
  };
})();

export default MockBackend;
