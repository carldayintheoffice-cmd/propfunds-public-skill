// Sign-up storage in SQLite (built into Node 22.13+). One file on disk, kept
// in DATA_DIR. The host must encrypt the disk and keep backups.

import { DatabaseSync } from 'node:sqlite';
import { randomInt } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const STATUSES = {
  new: 'New - call them',
  called: 'Called - preparing claim',
  claimSent: 'Claim sent - waiting for decision',
  approved: 'Approved - fee due',
  refused: 'Refused - no fee',
  feePaid: 'Fee paid',
  feeWaived: 'Fee waived (hardship)',
  cancelled: 'Cancelled',
};

// No 0/O, 1/I/L: easy to read out over the phone.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const newReference = () => 'CR-' + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export function openStore(dataDir) {
  let db;
  if (dataDir === ':memory:') {
    db = new DatabaseSync(':memory:');
  } else {
    mkdirSync(dataDir, { recursive: true });
    db = new DatabaseSync(join(dataDir, 'claimright.db'));
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS signups (
      id INTEGER PRIMARY KEY,
      reference TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      notes TEXT NOT NULL DEFAULT '',
      record TEXT NOT NULL
    )`);

  const row = (r) => r && {
    reference: r.reference,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    status: r.status,
    notes: r.notes,
    ...JSON.parse(r.record),
  };

  const insert = db.prepare('INSERT INTO signups (reference, created_at, updated_at, record) VALUES (?, ?, ?, ?)');
  const exists = db.prepare('SELECT 1 FROM signups WHERE reference = ?');

  return {
    add(record) {
      let reference;
      do { reference = newReference(); } while (exists.get(reference));
      const now = new Date().toISOString();
      insert.run(reference, now, now, JSON.stringify(record));
      return reference;
    },
    list() {
      return db.prepare('SELECT * FROM signups ORDER BY created_at DESC').all().map(row);
    },
    get(reference) {
      return row(db.prepare('SELECT * FROM signups WHERE reference = ?').get(reference));
    },
    update(reference, { status, notes }) {
      if (!(status in STATUSES)) throw new Error('unknown status');
      const res = db.prepare('UPDATE signups SET status = ?, notes = ?, updated_at = ? WHERE reference = ?')
        .run(status, String(notes ?? '').slice(0, 2000), new Date().toISOString(), reference);
      return res.changes === 1;
    },
    remove(reference) {
      return db.prepare('DELETE FROM signups WHERE reference = ?').run(reference).changes === 1;
    },
    close() { db.close(); },
  };
}
