import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';

const base = 'https://www.nasdaqtrader.com/dynamic/SymDir/';
const sources = ['nasdaqlisted.txt', 'otherlisted.txt'];
const exchanges = {Q: 'Nasdaq', N: 'NYSE', A: 'NYSE American', P: 'NYSE Arca', Z: 'Cboe BZX', V: 'IEX', L: 'LTSE', M: 'NYSE Chicago', T: 'Nasdaq Texas'};

export function parseDirectory(text, file) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split('|');
  if (!headers.includes('Security Name') || !headers.includes('Test Issue') || !headers.includes('ETF')) {
    throw new Error(`Unexpected directory headers in ${file}`);
  }
  const entries = [];
  for (const line of lines) {
    if (line.startsWith('File Creation Time:')) continue;
    const fields = line.split('|');
    const row = Object.fromEntries(headers.map((header, i) => [header, fields[i] ?? '']));
    if (row['Test Issue'] !== 'N') continue;
    const ticker = row.Symbol || row['CQS Symbol'] || row['ACT Symbol'];
    const name = row['Security Name'];
    if (!ticker || !name || !/^[A-Z0-9][A-Z0-9.\-]{0,9}$/.test(ticker)) continue;
    if (/\b(warrants?|rights?|units?|preferred (?:stock|shares?|securities|class|series)|preference shares?|debentures|notes|ETN|closed end fund|ZONES)\b/i.test(name)) continue;
    const kind = row.ETF === 'Y' ? 'ETF' : 'Stock';
    // The source directories also contain non-equity securities and closed-end funds.
    if (kind === 'Stock' && !/\b(common (?:stock|shares?)|ordinary shares?|american depositary|american depository|ADRs?|ADSs?|registry shares|voting shares|class [AB] shares)\b/i.test(name) && /\b(fund|trust|depositary|depository|preferred|preference|SBI)\b/i.test(name)) continue;
    entries.push({ticker, name, kind, exchange: file === 'nasdaqlisted.txt' ? 'Nasdaq' : exchanges[row.Exchange] ?? row.Exchange});
  }
  return {entries, sourceTime: lines.find(line => line.startsWith('File Creation Time:'))?.split('|')[0] ?? null};
}

async function main() {
  const results = await Promise.all(sources.map(async file => {
    const response = await fetch(base + file, {signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error(`Directory download failed (${response.status})`);
    return {file, ...parseDirectory(await response.text(), file)};
  }));
  const symbols = [...new Map(results.flatMap(result => result.entries).map(entry => [entry.ticker, entry])).values()]
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  if (symbols.length < 5000) throw new Error('Directory is unexpectedly small; existing snapshot was preserved');
  const output = fileURLToPath(new URL('../public/symbols/us-listed.json', import.meta.url));
  await mkdir(fileURLToPath(new URL('../public/symbols/', import.meta.url)), {recursive: true});
  await writeFile(output, JSON.stringify({capturedAt: new Date().toISOString(),
    sources: results.map(({file, sourceTime}) => ({url: base + file, sourceTime})), symbols}) + '\n');
  console.log(`Saved ${symbols.length.toLocaleString()} US-listed stocks and ETFs.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {console.error(error.message); process.exitCode = 1;});
}
