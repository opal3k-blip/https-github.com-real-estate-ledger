import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { performance } from 'perf_hooks';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';

const records = Number(process.env.LOAD_STRESS_RECORDS || 250);
const rules = readFileSync('./firestore.rules', 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId: 'demo-load',
  firestore: { rules, host: 'localhost', port: 8180 },
});

const ADMIN = 'opal3k@gmail.com';
const FUND_MANAGER = 'fund-manager@x.com';
const ANALYST = 'analyst-load@x.com';
const OUTSIDER = 'outsider@x.com';

function ctxFor(email) {
  return testEnv.authenticatedContext(email, { email });
}

function baseOpp(i) {
  return {
    meta: {
      name: `Load Opportunity ${i}`,
      city: i % 2 ? 'Riyadh' : 'Jeddah',
      oppType: 'income',
      createdBy: ANALYST,
      updatedBy: ANALYST,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    land: { area: 1000 + i, price: 2000 + i },
    ic: { decisions: [] },
  };
}

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'team_members', ANALYST), { expiresAt: null });
  await setDoc(doc(db, 'team_members', FUND_MANAGER), { expiresAt: null });
  await setDoc(doc(db, 'team_roles', FUND_MANAGER), { role: 'fund_manager' });
});

const analystDb = ctxFor(ANALYST).firestore();
const outsiderDb = ctxFor(OUTSIDER).firestore();
const fundManagerDb = ctxFor(FUND_MANAGER).firestore();

const writeStart = performance.now();
await Promise.all(Array.from({ length: records }, (_, i) =>
  assertSucceeds(setDoc(doc(analystDb, 'opportunities', `LOAD-${i}`), baseOpp(i)))
));
const writeMs = performance.now() - writeStart;

const readStart = performance.now();
const snap = await assertSucceeds(getDocs(collection(analystDb, 'opportunities')));
const readMs = performance.now() - readStart;

await assertFails(getDocs(collection(outsiderDb, 'opportunities')));

const queueStart = performance.now();
await Promise.all(Array.from({ length: Math.min(records, 100) }, (_, i) =>
  assertSucceeds(setDoc(doc(fundManagerDb, 'mondayTaskQueue', `LOAD-Q-${i}`), {
    oppId: `LOAD-${i}`,
    title: `Load task ${i}`,
    ownerEmail: 'saeed@opalco.sa',
    status: 'pending',
    queuedBy: FUND_MANAGER,
    queuedAt: new Date().toISOString(),
  }))
));
const queueMs = performance.now() - queueStart;

const result = {
  records,
  opportunityWritesMs: Math.round(writeMs),
  opportunityReadsMs: Math.round(readMs),
  mondayQueueWritesMs: Math.round(queueMs),
  readCount: snap.size,
};
console.log(JSON.stringify(result, null, 2));

const writeBudget = Math.max(10000, records * 80);
const readBudget = Math.max(5000, records * 30);
if (writeMs > writeBudget) throw new Error(`Write load exceeded ${Math.round(writeBudget)}ms budget.`);
if (readMs > readBudget) throw new Error(`Read load exceeded ${Math.round(readBudget)}ms budget.`);

await testEnv.cleanup();
