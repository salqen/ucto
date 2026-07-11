/* Úložisko dát:
 *  - PRODUKCIA (Vercel): Vercel KV / Upstash Redis cez REST API
 *  - VÝVOJ (lokálne):    súbor data/db.json
 * Automaticky sa prepne podľa toho, či sú nastavené KV/Upstash env premenné.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SEED_FILE = path.join(DATA_DIR, 'seed.json');
const KEY = process.env.KV_KEY || 'ucto-erp:db';

// akceptujeme viac možných názvov premenných (Vercel KV aj Upstash Marketplace)
const REST_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REDIS_REST_API_URL ||
  '';
const REST_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REDIS_REST_API_TOKEN ||
  '';

let redis = null;
if (REST_URL && REST_TOKEN) {
  try {
    const { Redis } = require('@upstash/redis');
    redis = new Redis({ url: REST_URL, token: REST_TOKEN });
  } catch (e) {
    console.error('KV klient sa nepodarilo načítať, používam lokálny súbor:', e.message);
  }
}

const usingKV = !!redis;

async function readRaw() {
  if (redis) {
    const v = await redis.get(KEY);
    if (v == null) return null;
    return typeof v === 'string' ? JSON.parse(v) : v;
  }
  if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  return null;
}

async function writeRaw(obj) {
  if (redis) {
    await redis.set(KEY, JSON.stringify(obj));
    return;
  }
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(obj, null, 2), 'utf8');
}

/* počiatočné dáta (nasadené v repozitári) — použijú sa, keď je úložisko prázdne.
   Používame require (statická cesta), aby Vercel súbor spoľahlivo pribalil do funkcie. */
function readSeed() {
  try {
    return require('../data/seed.json');
  } catch (e) {
    try {
      if (fs.existsSync(SEED_FILE)) return JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    } catch (_) {}
    console.error('Nepodarilo sa načítať seed.json:', e.message);
    return null;
  }
}

module.exports = { readRaw, writeRaw, readSeed, usingKV, KEY };
