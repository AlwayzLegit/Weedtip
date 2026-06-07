#!/usr/bin/env node
// @ts-nocheck
// Fidelity checker for the generated LA dispensary seed migration.
// Parses the migration's VALUES tuples and computes an md5 over the text fields
// (plus latitude/longitude sums) so the same can be recomputed in SQL and compared.
//
// Usage: node scripts/verify-la-import.mjs <migration.sql>

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/verify-la-import.mjs <migration.sql>');
  process.exit(1);
}

// Tokenize one SQL VALUES tuple (the text between the outer parens) into fields,
// honoring single-quote strings with '' escaping. Returns raw tokens.
function splitTuple(s) {
  const out = [];
  let cur = '';
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === "'") {
        if (s[i + 1] === "'") {
          cur += "''";
          i++;
        } else {
          inStr = false;
          cur += c;
        }
      } else cur += c;
    } else if (c === "'") {
      inStr = true;
      cur += c;
    } else if (c === ',') {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  if (cur.trim() !== '') out.push(cur.trim());
  return out;
}

// Convert a raw SQL token to its logical value: strip quotes + unescape, null->''.
function unq(tok) {
  if (tok === 'null') return '';
  if (tok.startsWith("'") && tok.endsWith("'")) {
    return tok.slice(1, -1).replace(/''/g, "'");
  }
  return tok; // bare: numbers, true/false
}

const text = readFileSync(file, 'utf8');
const lines = text.split('\n');

const SEP = '\x1f';
const records = [];
let sumLat = 0;
let sumLng = 0;

for (let line of lines) {
  const t = line.trim();
  if (!t.startsWith('(')) continue; // only VALUES tuples
  // strip leading '(' and trailing ')' or '),'
  let body = t.replace(/,$/, '');
  body = body.slice(1, -1); // remove outer parens
  const f = splitTuple(body);
  if (f.length < 16) continue;
  const [
    name, slug, address, city, state, zip, phone, email, website, license,
    med, rec, del, pickup, location /* , status */,
  ] = f;
  const canonical = [
    unq(name), unq(slug), unq(address), unq(city), unq(state), unq(zip),
    unq(phone), unq(email), unq(website), unq(license),
    unq(med), unq(rec), unq(del), unq(pickup),
  ].join(SEP);
  records.push({ license: unq(license), canonical });
  // location is 'SRID=4326;POINT(<lng> <lat>)'::geography
  const m = location.match(/POINT\(([-0-9.]+) ([-0-9.]+)\)/);
  if (m) {
    sumLng += Number(m[1]);
    sumLat += Number(m[2]);
  }
}

records.sort((a, b) => (a.license < b.license ? -1 : a.license > b.license ? 1 : 0));
const blob = records.map((r) => r.canonical).join('\n');
const md5 = createHash('md5').update(blob, 'utf8').digest('hex');

console.log(JSON.stringify({
  count: records.length,
  md5,
  sum_lat: Number(sumLat.toFixed(6)),
  sum_lng: Number(sumLng.toFixed(6)),
}, null, 2));
