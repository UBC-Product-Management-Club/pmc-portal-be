// Runs the Home migration against an in-process Postgres (PGlite), like the
// other files here. Run with: npm run test:sql
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { PGlite } = require('@electric-sql/pglite');

const MIGRATION = path.join(__dirname, '../migrations/20261101000000_home.sql');

async function fresh() {
    const db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create type "ATTENDEE_STATUS" as enum ('APPLIED','ACCEPTED','PROCESSING','REGISTERED','REJECTED','FAILED');
      create table "Attendee" (
        attendee_id uuid primary key default gen_random_uuid(), user_id varchar not null, event_id uuid not null,
        status "ATTENDEE_STATUS", payment_due_at timestamptz);
      create table "Drafts" (user_id varchar not null, event_id uuid not null, draft_data jsonb, version int not null default 0);
    `);
    await db.exec(fs.readFileSync(MIGRATION, 'utf8'));
    return db;
}

// One announcement; column and sql set one more field, e.g. 'is_active', 'false'
const add = (db, title, column, sql) =>
    db.exec(column
        ? `insert into "Announcement" (title, body, ${column}) values ('${title}', 'body', ${sql})`
        : `insert into "Announcement" (title, body) values ('${title}', 'body')`);
const titles = async (db, isMember) =>
    (await db.query(`select title from active_announcements($1)`, [isMember])).rows.map((r) => r.title);
const fails = async (p, code) => {
    try { await p; } catch (e) { assert.ok(e.message.includes(code), `expected ${code}, got ${e.message}`); return; }
    assert.fail(`expected ${code}`);
};

const E1 = '11111111-1111-1111-1111-111111111111';
const E2 = '22222222-2222-2222-2222-222222222222';
const E3 = '33333333-3333-3333-3333-333333333333';

const tests = {
    async 'returns only active announcements inside their window'() {
        const db = await fresh();
        await add(db, 'live');
        await add(db, 'inactive', 'is_active', 'false');
        await add(db, 'future', 'starts_at', "now() + interval '1 hour'");
        await add(db, 'expired', 'ends_at', "now() - interval '1 second'");
        await add(db, 'started', 'starts_at', "now() - interval '1 hour'");
        assert.deepEqual((await titles(db, false)).sort(), ['live', 'started']);
    },
    async 'orders by display_order, then newest first'() {
        const db = await fresh();
        await db.exec(`insert into "Announcement" (title, body, display_order, created_at) values
          ('old', 'b', 1, now() - interval '2 days'), ('new', 'b', 1, now()), ('first', 'b', 0, now() - interval '9 days')`);
        assert.deepEqual(await titles(db, false), ['first', 'new', 'old']);
    },
    async 'members never see the membership offer, and non-members never see member-only rows'() {
        const db = await fresh();
        await add(db, 'all');
        await add(db, 'offer', 'audience', "'non_members'");
        await add(db, 'perk', 'audience', "'members'");
        assert.deepEqual((await titles(db, true)).sort(), ['all', 'perk']);
        assert.deepEqual((await titles(db, false)).sort(), ['all', 'offer']);
    },
    async 'audience must be one of the three'() {
        const db = await fresh();
        await fails(add(db, 'x', 'audience', "'admins'"), 'check');
    },
    async 'statuses cover applications, drafts and both'() {
        const db = await fresh();
        await db.exec(`
          insert into "Attendee" (user_id, event_id, status, payment_due_at) values
            ('u1', '${E1}', 'ACCEPTED', '2026-11-05T22:00:00Z'), ('u1', '${E2}', 'APPLIED', null), ('u2', '${E3}', 'REGISTERED', null);
          insert into "Drafts" (user_id, event_id) values ('u1', '${E2}'), ('u1', '${E3}');`);
        const rows = (await db.query(`select * from event_statuses('u1') order by event_id`)).rows;
        assert.deepEqual(rows.map((r) => [r.event_id, r.status, r.has_draft]), [
            [E1, 'ACCEPTED', false],
            [E2, 'APPLIED', true],
            [E3, null, true],
        ]);
        assert.equal(rows[0].payment_due_at.toISOString(), '2026-11-05T22:00:00.000Z');
    },
    async 'running it twice is harmless'() {
        const db = await fresh();
        await db.exec(fs.readFileSync(MIGRATION, 'utf8'));
    },
    async 'students cannot call the functions directly'() {
        const db = await fresh();
        await db.exec('set role authenticated');
        await fails(titles(db, false), 'permission denied');
    },
};

(async () => {
    let failed = 0;
    for (const [name, fn] of Object.entries(tests)) {
        try { await fn(); console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '-', e.message); }
    }
    console.log(failed ? `${failed} failed` : 'all passed');
    process.exit(failed ? 1 : 0);
})();
