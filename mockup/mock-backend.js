// Simple mocked backend using localStorage for POC
const MockBackend = (function(){
  const KEY = 'poc_bi_rules_v1';
  function _loadAll(){
    const raw = localStorage.getItem(KEY);
    if(!raw) {
      const demo = { rules: [demoRule()] };
      localStorage.setItem(KEY, JSON.stringify(demo));
      return demo;
    }
    return JSON.parse(raw);
  }
  function _saveAll(data){ localStorage.setItem(KEY, JSON.stringify(data)); }

  function demoRule(){
    return {
      id: 'bp-001',
      title: 'Payment Platform',
      description: 'POC example',
      active: true,
      version: 1,
      nodes: [
        { id: 'n1', label: 'Payment', selector: 'hostA:pay', type: 'service', x:120,y:80,w:160,h:56,color:'#ffd54f', states:['CRITICAL'], aggregation:'majority' },
        { id: 'n2', label: 'DB', selector: 'hostB:postgres', type:'service', x:420,y:80,w:140,h:56,color:'#90caf9', states:['CRITICAL'], aggregation:'majority' }
      ],
      edges: [
        { id:'e1', sourceId:'n1', targetId:'n2', waypoints:[], operator:'AND' }
      ],
      ui_meta: { created_by:'poc', created_at: new Date().toISOString()}
    };
  }

  return {
    listRules: async function(){ return _loadAll().rules; },
    getRule: async function(id){
      return _loadAll().rules.find(r=>r.id===id) || null;
    },
    createOrUpdateRule: async function(rule){
      const data = _loadAll();
      const idx = data.rules.findIndex(r=>r.id===rule.id);
      if(idx>=0){ rule.version = (data.rules[idx].version||1)+1; data.rules[idx]=rule; }
      else { rule.version = 1; data.rules.push(rule); }
      _saveAll(data);
      return rule;
    },
    deleteRule: async function(id){
      const data = _loadAll();
      data.rules = data.rules.filter(r=>r.id!==id);
      _saveAll(data);
      return true;
    }
  };
})();
