const elements = new Map();
const element = () => ({
  innerHTML: '',
  value: '',
  style: {},
  dataset: {},
  setAttribute() {},
  addEventListener() {},
  appendChild() {},
  querySelector() { return null; },
  querySelectorAll() { return []; },
});
globalThis.document = {
  addEventListener() {},
  createElement: element,
  getElementById(id) {
    if(!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  body: element(),
  documentElement: element(),
};
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
  removeItem() {},
};
globalThis.Notification = undefined;
Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: { writeText() {} } },
  configurable: true,
});

const core = await import('../src/core.js');
const { computeInvestmentScore } = await import('../src/features/investment-score.js');
const { generateAnalystNarrative } = await import('../src/features/ai-analyst.js');
const { computeDecisionConfidence } = await import('../src/features/decision-confidence.js');
const { defaultItemsDict } = await import('../src/features/due-diligence.js');
const { icReadiness } = await import('../src/features/ic-decision-gate.js');
await import('../src/features/automated-ic-memo.js');
await import('../src/features/excel-workbook.js');
await import('../src/features/ic-book-print.js');
await import('../src/features/ic-presentation.js');

const results = [];

function assert(condition, message){
  if(!condition) throw new Error(message);
}

function clone(v){
  return JSON.parse(JSON.stringify(v));
}

function render(){
  const passed = results.filter(r=>r.status==='PASS').length;
  const failed = results.length - passed;
  document.getElementById('summary').innerHTML = failed
    ? `<span class="fail">${failed} failed</span> · <span class="pass">${passed} passed</span> · ${results.length} total`
    : `<span class="pass">All ${passed} tests passed</span>`;
  document.getElementById('results').innerHTML = results.map(r=>`
    <tr>
      <td><code>${r.id}</code></td>
      <td class="${r.status==='PASS'?'pass':'fail'}">${r.status}</td>
      <td>${r.description}</td>
      <td>${r.notes || '—'}</td>
    </tr>
  `).join('');
}

async function run(id, description, fn){
  try{
    const notes = await fn();
    results.push({ id, status:'PASS', description, notes });
  }catch(err){
    console.error(id, err);
    results.push({ id, status:'FAIL', description, notes: err && err.message ? err.message : String(err) });
  }
  render();
}

function completedDD(){
  const items = defaultItemsDict();
  Object.keys(items).forEach(key=>{
    items[key] = {
      status:'completed',
      document:'Test Support',
      reviewer:'QA',
      date:'2026-09-09',
      finding:'',
      severity:'low',
      requiredAction:'',
    };
  });
  return items;
}

function evidenceForPaths(paths){
  const evidence = {};
  paths.forEach(path=>{
    evidence[path] = {
      source:'Validation Source',
      tier:'tier1',
      date:'2026-09-09',
      confidence:'high',
      verifiedBy:'senior-ic@example.com',
      verifiedAt:'2026-09-09',
    };
  });
  return evidence;
}

function makeIncomeOpportunity(){
  const d = core.blankOpportunity();
  d.meta.name = 'Income Validation';
  d.meta.city = 'الرياض';
  d.meta.neighborhood = 'الصحافة';
  d.meta.oppType = 'income';
  d.meta.useType = 'مكتبي (Office)';
  d.meta.createdAt = '2026-09-01';
  d.meta.updatedAt = '2026-09-09';
  d.land.area = 5200;
  d.land.price = 2400;
  d.land.far = 2.2;
  d.income.rent = 1100;
  d.income.occupancy = 0.95;
  d.income.opex = 0.20;
  d.financing.ltc = 0.55;
  d.financing.saibor = 0.05;
  d.financing.margin = 0.02;
  d.wacc.marketCap = 0.075;
  d.score = { manual:{ location:82, market:78, acquisitionPrice:80, developmentFeasibility:75, liquidityExit:76 } };
  return d;
}

function makeDevelopmentOpportunity(){
  const d = core.blankOpportunity();
  d.meta.name = 'Development Validation';
  d.meta.city = 'جدة';
  d.meta.neighborhood = 'الزهراء';
  d.meta.oppType = 'development';
  d.meta.useType = 'سكني (Residential)';
  d.meta.createdAt = '2026-09-01';
  d.meta.updatedAt = '2026-09-09';
  d.land.area = 4800;
  d.land.price = 2200;
  d.land.far = 2.6;
  d.development.salePrice = 11500;
  d.development.buildCost = 3400;
  d.development.constructionYears = 2;
  d.development.operationYears = 1;
  d.development.exitCapRate = 0.075;
  d.financing.ltc = 0.55;
  d.financing.saibor = 0.05;
  d.financing.margin = 0.02;
  d.score = { manual:{ location:80, market:76, acquisitionPrice:79, developmentFeasibility:82, liquidityExit:70 } };
  return d;
}

function incomeEvidencePaths(){
  return [
    'land.price',
    'land.far',
    'financing.saibor',
    'financing.margin',
    'income.rent',
    'income.occupancy',
    'wacc.marketCap',
  ];
}

function developmentEvidencePaths(){
  return [
    'land.price',
    'land.far',
    'financing.saibor',
    'financing.margin',
    'development.salePrice',
    'development.buildCost',
    'development.exitCapRate',
  ];
}

function makeHighConfidenceIncome(){
  const d = makeIncomeOpportunity();
  d.dd = { items: completedDD() };
  d.evidence = evidenceForPaths(incomeEvidencePaths());
  return d;
}

function makeHighConfidenceDevelopment(){
  const d = makeDevelopmentOpportunity();
  d.dd = { items: completedDD() };
  d.evidence = evidenceForPaths(developmentEvidencePaths());
  return d;
}

await run('TEST-001', 'As-of date prefers updatedAt when available', ()=>{
  const d = core.blankOpportunity();
  d.meta.createdAt = '2026-01-01';
  d.meta.updatedAt = '2026-09-09';
  const meta = core.reportDateMeta(d);
  assert(meta.asOfDate === '2026-09-09', `Expected updatedAt to win, got ${meta.asOfDate}`);
  return meta.asOfText;
});

await run('TEST-002', 'As-of date falls back to createdAt when updatedAt is missing', ()=>{
  const d = core.blankOpportunity();
  d.meta.createdAt = '2026-01-01';
  d.meta.updatedAt = null;
  const meta = core.reportDateMeta(d);
  assert(meta.asOfDate === '2026-01-01', `Expected createdAt fallback, got ${meta.asOfDate}`);
  return meta.asOfText;
});

await run('TEST-003', 'As-of date falls back to today when opportunity has no stored dates', ()=>{
  const d = core.blankOpportunity();
  d.meta.createdAt = null;
  d.meta.updatedAt = null;
  const meta = core.reportDateMeta(d);
  assert(meta.asOfDate === core.todayStr(), `Expected today fallback, got ${meta.asOfDate}`);
  return meta.asOfDate;
});

await run('TEST-004', 'High-confidence underwriting scores high on Decision Confidence', ()=>{
  const d = makeHighConfidenceIncome();
  const conf = computeDecisionConfidence(core, d);
  assert(conf.score >= 80, `Expected confidence >= 80, got ${conf.score}`);
  assert(conf.band.key === 'high', `Expected high band, got ${conf.band.key}`);
  return `${conf.score.toFixed(0)}/100`;
});

await run('TEST-005', 'Critical evidence gaps cap Decision Confidence below 50', ()=>{
  const d = makeIncomeOpportunity();
  d.dd = { items: completedDD() };
  d.evidence = {};
  const conf = computeDecisionConfidence(core, d);
  assert(conf.score < 50, `Expected capped confidence < 50, got ${conf.score}`);
  assert(conf.blockers.some(b=>b.key==='critical-sources-missing'), 'Expected critical-sources blocker');
  return `${conf.score.toFixed(0)}/100`;
});

await run('TEST-006', 'Attractive economics can still have low Decision Confidence', ()=>{
  const d = makeIncomeOpportunity();
  d.dd = { items: completedDD() };
  d.evidence = {};
  const c = core.compute(d);
  const score = computeInvestmentScore(core, d, c);
  const conf = computeDecisionConfidence(core, d);
  assert(score.composite > 70, `Expected strong investment score, got ${score.composite}`);
  assert(conf.score < 50, `Expected low confidence, got ${conf.score}`);
  return `Score ${score.composite.toFixed(0)} / Confidence ${conf.score.toFixed(0)}`;
});

await run('TEST-007', 'Weak economics can still be well-documented with high Decision Confidence', ()=>{
  const d = makeHighConfidenceIncome();
  d.land.price = 7000;
  d.income.rent = 450;
  d.score.manual = { location:35, market:30, acquisitionPrice:25, developmentFeasibility:30, liquidityExit:35 };
  const c = core.compute(d);
  const score = computeInvestmentScore(core, d, c);
  const conf = computeDecisionConfidence(core, d);
  assert(score.composite < 55, `Expected weaker investment score, got ${score.composite}`);
  assert(conf.score >= 80, `Expected preserved high confidence, got ${conf.score}`);
  return `Score ${score.composite.toFixed(0)} / Confidence ${conf.score.toFixed(0)}`;
});

await run('TEST-008', 'AI Analyst narrative explicitly separates Investment Score from Decision Confidence', ()=>{
  const d = makeHighConfidenceIncome();
  const narrative = generateAnalystNarrative(core, d, core.compute(d));
  const joined = narrative.paras.join(' ');
  assert(joined.includes('وليست مقياساً لثقة القرار'), 'Expected explicit non-confidence wording');
  assert(joined.includes('ثقة القرار الحالية'), 'Expected Decision Confidence paragraph');
  return 'Narrative separation verified';
});

await run('TEST-009', 'AI Analyst narrative uses caveated language for recommendation', ()=>{
  const d = makeHighConfidenceIncome();
  const narrative = generateAnalystNarrative(core, d, core.compute(d));
  const joined = narrative.paras.join(' ');
  assert(joined.includes('تبدو الفرصة جاهزة نسبياً') || joined.includes('ما تزال الفرصة تحت المراجعة') || joined.includes('تبقى الفرصة دون معايير القبول'), 'Expected caveated conclusion wording');
  assert(joined.includes('تحقق مستقل'), 'Expected independent-validation caveat');
  return 'Caveated conclusion verified';
});

await run('TEST-010', 'Higher rent improves income-opportunity Equity IRR', ()=>{
  const base = makeIncomeOpportunity();
  const up = clone(base);
  up.income.rent = base.income.rent * 1.15;
  const c1 = core.compute(base);
  const c2 = core.compute(up);
  assert(c2.equityIRR > c1.equityIRR, `Expected higher IRR, got ${c1.equityIRR} -> ${c2.equityIRR}`);
  return `${core.fmtPct(c1.equityIRR,1)} → ${core.fmtPct(c2.equityIRR,1)}`;
});

await run('TEST-011', 'Higher land price reduces income-opportunity Equity IRR', ()=>{
  const base = makeIncomeOpportunity();
  const down = clone(base);
  down.land.price = base.land.price * 1.25;
  const c1 = core.compute(base);
  const c2 = core.compute(down);
  assert(c2.equityIRR < c1.equityIRR, `Expected lower IRR, got ${c1.equityIRR} -> ${c2.equityIRR}`);
  return `${core.fmtPct(c1.equityIRR,1)} → ${core.fmtPct(c2.equityIRR,1)}`;
});

await run('TEST-012', 'Higher sale price improves development-opportunity Equity IRR', ()=>{
  const base = makeDevelopmentOpportunity();
  const up = clone(base);
  up.development.salePrice = base.development.salePrice * 1.12;
  const c1 = core.compute(base);
  const c2 = core.compute(up);
  assert(c2.equityIRR > c1.equityIRR, `Expected higher IRR, got ${c1.equityIRR} -> ${c2.equityIRR}`);
  return `${core.fmtPct(c1.equityIRR,1)} → ${core.fmtPct(c2.equityIRR,1)}`;
});

await run('TEST-013', 'Higher build cost reduces development-opportunity Equity IRR', ()=>{
  const base = makeDevelopmentOpportunity();
  const down = clone(base);
  down.development.buildCost = base.development.buildCost * 1.18;
  const c1 = core.compute(base);
  const c2 = core.compute(down);
  assert(c2.equityIRR < c1.equityIRR, `Expected lower IRR, got ${c1.equityIRR} -> ${c2.equityIRR}`);
  return `${core.fmtPct(c1.equityIRR,1)} → ${core.fmtPct(c2.equityIRR,1)}`;
});

await run('TEST-014', 'IC readiness fails when Project IRR is below an explicit threshold', ()=>{
  const d = makeHighConfidenceDevelopment();
  const c = core.compute(d);
  d.criteria.projIrrMin = (c.projectIRR || 0) + 0.05;
  const gate = icReadiness(core, d, c);
  assert(gate.ready === false, 'Expected gate not ready');
  assert(gate.reasons.some(r=>String(r.en || '').includes('Project IRR below minimum')), 'Expected Project IRR gate failure');
  return gate.reasons.map(r=>r.en).join('; ');
});

render();
document.body.setAttribute('data-suite-status', results.some(r=>r.status==='FAIL') ? 'fail' : 'pass');
const failedCount = results.filter(r=>r.status==='FAIL').length;
console.log(`Financial model validation: ${results.length - failedCount}/${results.length} passed`);
if(failedCount) process.exitCode = 1;
