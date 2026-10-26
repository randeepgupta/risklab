import assert from 'node:assert/strict';
import {formatDate,formatDateTime,parseUSDate} from '../src/utils/dateFormat';

assert.equal(formatDate('2026-10-26'),'10/26/2026');
assert.equal(formatDate('2026-01-02'),'01/02/2026');
assert.equal(formatDate('2024-02-29'),'02/29/2024');
for(const value of ['2026-02-29','2026-04-31','2026-13-01','bad',undefined]) assert.equal(formatDate(value),'Unavailable');
assert.equal(parseUSDate('10/26/2026'),'2026-10-26');
assert.equal(parseUSDate('01/02/2026'),'2026-01-02','month and day cannot be swapped by browser locale');
assert.equal(parseUSDate('02/29/2024'),'2024-02-29');
for(const value of ['02/29/2026','04/31/2026','13/01/2026','26/10/2026','2026-10-26','1/2/2026','']) assert.equal(parseUSDate(value),null);
const midnight=new Date('2026-10-26T00:30:00Z');
const localDay=`${String(midnight.getMonth()+1).padStart(2,'0')}/${String(midnight.getDate()).padStart(2,'0')}/${midnight.getFullYear()}`;
assert.ok(formatDateTime(midnight.toISOString()).startsWith(`${localDay}, `),'timestamps show their local calendar day');
assert.equal(formatDate('2026-10-26'),'10/26/2026','date-only observations never shift with the time zone');
assert.equal(formatDateTime('bad'),'Unavailable');
console.log('U.S. date formatting, strict calendar input and timezone boundaries passed.');
