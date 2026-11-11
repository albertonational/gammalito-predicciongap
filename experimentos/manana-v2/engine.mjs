// MAÑANA V2 - laboratorio aislado. No altera las predicciones originales.
// Entrada: snapshot congelado ANTES de la señal. No utiliza datos posteriores.
export const TICKERS=['AAPL','AMZN','GLD','META','MSFT','NFLX','PLTR','QQQ','SPY','TSLA'];
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function evaluate(snapshot){
 if(!snapshot||!TICKERS.includes(snapshot.ticker)||!['CALL','PUT'].includes(snapshot.side))
  return {status:'SIN_DATOS',reasons:['Ticker o dirección inválidos'],score:null};
 const s=snapshot,dir=s.side==='CALL'?1:-1,checks=[];
 const check=(name,value,pass)=>checks.push({name,available:finite(value),pass:finite(value)?Boolean(pass(value)):null});
 // Los siguientes criterios son candidatos, NO umbrales optimizados ni validados.
 check('Distancia de Gamma Zero (%)',s.gammaZeroDistancePct,x=>dir*x>0);
 check('Momentum 15m (%)',s.momentum15mPct,x=>dir*x>0);
 check('Distancia del cierre previo (%)',s.fromPrevClosePct,x=>dir*x>=0);
 check('Persistencia: velas consecutivas',s.confirmingBars15m,x=>x>=2);
 const available=checks.filter(x=>x.available),passed=available.filter(x=>x.pass).length;
 return {status:available.length<4?'SIN_DATOS':passed===4?'FAVORABLE':passed>=2?'PRECAUCION':'DEBIL',
 score:available.length===4?passed+'/4':null,checks,
 reasons:checks.filter(x=>!x.available).map(x=>'Falta '+x.name)};
}
export function compare(records){
 return records.map(r=>({date:r.date,ticker:r.snapshot?.ticker,original:r.snapshot?.side,
  v2:evaluate(r.snapshot),outcome:r.outcome??'PENDIENTE'}));
}
