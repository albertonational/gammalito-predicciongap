import {evaluate,compare} from './engine.mjs';import assert from 'node:assert/strict';
const s={ticker:'SPY',side:'CALL',gammaZeroDistancePct:0.2,momentum15mPct:0.3,fromPrevClosePct:0.4,confirmingBars15m:2};
assert.equal(evaluate(s).side,'CALL');
assert.equal(evaluate({...s,ticker:'QQQ'}).side,'CALL');
assert.equal(evaluate({...s,ticker:'TSLA'}).side,null);
assert.equal(evaluate({...s,momentum15mPct:null}).side,null);
assert.equal(evaluate({...s,side:'PUT'}).side,null);
assert.equal(compare([{date:'2026-11-05',snapshot:s},{date:'2026-11-05',snapshot:{...s,ticker:'TSLA'}}]).length,1);
console.log('6 checks passed');