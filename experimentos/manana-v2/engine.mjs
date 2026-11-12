// GAP V2: SPY y QQQ solamente. Laboratorio aislado, sin datos futuros.
export const TICKERS=['SPY','QQQ'];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function evaluate(s){
 if(!s||!TICKERS.includes(s.ticker)||!['CALL','PUT'].includes(s.side))return {side:null,reason:'SIN_DATOS'};
 const needed=['gammaZeroDistancePct','momentum15mPct','fromPrevClosePct','confirmingBars15m'];
 if(needed.some(k=>!finite(s[k])))return {side:null,reason:'SIN_DATOS'};
 // Regla candidata, NO validada: solo devuelve CALL/PUT si hay confirmación.
 const direction=s.side==='CALL'?1:-1;
 const positive=[direction*s.gammaZeroDistancePct>0,direction*s.momentum15mPct>0,direction*s.fromPrevClosePct>=0,s.confirmingBars15m>=2].filter(Boolean).length;
 // En caso de desacuerdo, no inventar una dirección.
 return positive>=3?{side:s.side,reason:'CANDIDATO'}:{side:null,reason:'SIN_CONFIRMACION'};
}
export function compare(records){return records.filter(r=>TICKERS.includes(r.snapshot?.ticker)).map(r=>({date:r.date,ticker:r.snapshot.ticker,original:r.snapshot.side,v2:evaluate(r.snapshot).side,outcome:r.outcome??null}));}
