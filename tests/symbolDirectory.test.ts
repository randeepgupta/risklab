import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseDirectory} from '../scripts/update-symbol-directory.mjs';
import {createListedPosition, searchSymbols, ListedSymbol} from '../src/utils/symbolDirectory';
import {calculatePortfolioRisk, buildCorrelationMatrix, positionModelTicker, executeStressTest, ASSET_DATABASE} from '../src/utils/quantEngine';

const snapshot = JSON.parse(readFileSync(new URL('../public/symbols/us-listed.json', import.meta.url), 'utf8'));
const symbols: ListedSymbol[] = snapshot.symbols;
assert.ok(symbols.length > 10000);
assert.equal(new Set(symbols.map(s => s.ticker)).size, symbols.length);
for (const ticker of ['AAP','ASML','BRK.B','VOO','VTI','VXUS','SCHD','CRM','META','UBER','COIN','BABA','QQQ']) {
  assert.equal(searchSymbols(symbols, ticker, new Set())[0]?.ticker, ticker);
}
assert.ok(searchSymbols(symbols, 'Vanguard', new Set()).every(s => /vanguard/i.test(s.name)));
assert.equal(searchSymbols(symbols, 'VOO', new Set(['VOO'])).some(s => s.ticker === 'VOO'), false);
assert.equal(searchSymbols(symbols, 'ticker-does-not-exist', new Set()).length, 0);
assert.equal(searchSymbols(symbols, '', new Set()).length, 40);
const fixture = 'Symbol|Security Name|Test Issue|ETF\nABC|ABC Common Stock|N|N\nABCP|ABC Preferred Share|N|N\nABCR|ABC Right|N|N\nABCU|ABC Units|N|N\nETFX|Example ETF|N|Y\nTEST|Test Common Stock|Y|N\nORD|Example Ordinary Share|N|N\nADR|Example ADS|N|N\nCEF|Example Closed End Fund|N|N\nFile Creation Time: 1006202621:31||||';
assert.deepEqual(parseDirectory(fixture, 'nasdaqlisted.txt').entries.map(s => s.ticker), ['ABC','ETFX','ORD','ADR']);
const voo = symbols.find(s => s.ticker === 'VOO')!;
assert.throws(() => createListedPosition(voo, 50000, 0.5), /proxy/);
assert.throws(() => createListedPosition(voo, 50000, 0.5, 'MISSING'), /proxy/);
const proxy = createListedPosition(voo, 50000, 0.5, 'SPY');
assert.equal(proxy.ticker, 'VOO'); assert.equal(proxy.name, voo.name);
assert.equal(proxy.price, 0); assert.equal(proxy.riskProxyTicker, 'SPY');
const spy = createListedPosition(symbols.find(s => s.ticker === 'SPY')!, 50000, 0.5);
const qqq = createListedPosition(symbols.find(s => s.ticker === 'QQQM')!, 50000, 0.5);
const modeledMetrics = calculatePortfolioRisk([spy, qqq]);
const proxyMetrics = calculatePortfolioRisk([proxy, qqq]);
for (const key of ['annualizedVolatility','portfolioBeta','expectedAnnualReturn','durationSensitivity','var95_1d'] as const) {
  assert.ok(Math.abs(proxyMetrics[key] - modeledMetrics[key]) < 1e-10, key);
}
assert.equal(proxyMetrics.riskContributions[0].ticker, 'VOO');
const matrix = buildCorrelationMatrix([proxy.ticker, qqq.ticker], [proxy, qqq].map(positionModelTicker));
assert.deepEqual(matrix.matrix, buildCorrelationMatrix(['SPY','QQQM']).matrix);
assert.deepEqual(matrix.tickers, ['VOO','QQQM']);
const scenario = {id: 'test', name: 'Proxy shock', description: '', category: 'custom' as const, tickerShocks: {SPY: -0.2}};
assert.equal(executeStressTest([proxy], scenario).attributions[0].shockPct, -0.2);
assert.equal(executeStressTest([proxy], {...scenario, tickerShocks: {SPY: -0.2, VOO: -0.3}}).attributions[0].shockPct, -0.3);
const factorScenario = {...scenario, tickerShocks: {}, factorShocks: {equityShockPct: -20, rateChangeBps: 100, vixSpikePct: 0, semiShockPct: -20, techShockPct: -20}};
assert.equal(executeStressTest([proxy], factorScenario).percentLoss, executeStressTest([spy], factorScenario).percentLoss);
const sameProxy = calculatePortfolioRisk([proxy, spy]);
assert.ok(Math.abs(sameProxy.annualizedVolatility - ASSET_DATABASE.SPY.volatility) < 1e-5, 'same proxy cannot create diversification');
console.log(`Symbol directory and proxy tests passed (${symbols.length.toLocaleString()} listings).`);
