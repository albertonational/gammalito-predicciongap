import {evaluate,compare} from './engine.mjs';
import assert from 'node:assert/strict';
const base={ticker:'SPY',side:'CALL',gammaZeroDistancePct:0.2,momentum15mPct:0.3,fromPrevClosePct:0.4,confirmingBars15m:2};
assert.equal(evaluate(base).status,'FAVORABLE');
assert.equal(evaluate({...base,side:'PUT'}).status,'DEBIL');
assert.equal(evaluate({...base,momentum15mPct:null}).status,'SIN_DATOS');
assert.equal(evaluate({...base,ticker:'INVALID'}).status,'SIN_DATOS');
assert.equal(compare([{date:'2026-11-05',snapshot:base}])[0].outcome,'PENDIENTE');
console.log('MAÑANA V2: 5 pruebas correctas');
