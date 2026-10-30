// Runs the registration-checks migration against an in-process Postgres (PGlite)
// and checks each rule. There's no local Supabase, so this is how the SQL is
// tested before it's hand-run on staging. Run with: npm run test:sql
const fs = require('fs');
const assert = require('assert');
const { PGlite } = require('@electric-sql/pglite');

const MIGRATION = require('path').join(__dirname, '../migrations/20261025000000_register_checks.sql');

async function fresh() {
    const db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create type "ATTENDEE_STATUS" as enum ('APPLIED','ACCEPTED','PROCESSING','REGISTERED');
      create table "Event" (
        event_id uuid primary key, name text, max_attendees int, needs_review boolean not null default true,
        is_disabled boolean default false, registration_opens timestamptz, registration_closes timestamptz);
      create table "Attendee" (
        attendee_id uuid primary key default gen_random_uuid(), user_id text not null, event_id uuid not null,
        event_form_answers jsonb, is_payment_verified boolean not null default false, payment_id text,
        status "ATTENDEE_STATUS", created_at timestamptz default now());
    `);
    await db.exec(fs.readFileSync(MIGRATION, 'utf8'));
    return db;
}

const E = '11111111-1111-1111-1111-111111111111';
const addEvent = (db, fields = {}) => {
    const f = { max_attendees: 2, needs_review: true, opens: "now() - interval '1 day'", closes: "now() + interval '1 day'", disabled: false, ...fields };
    return db.exec(`insert into "Event" values ('${E}', 'PJ', ${f.max_attendees ?? 'null'}, ${f.needs_review}, ${f.disabled}, ${f.opens}, ${f.closes})`);
};
const apply = (db, user) => db.query(`select * from submit_application($1, $2, '{"name":"A"}'::jsonb)`, [E, user]);
const fails = async (p, code) => {
    try { await p; } catch (e) { assert.ok(e.message.includes(code), `expected ${code}, got ${e.message}`); return; }
    assert.fail(`expected ${code}`);
};

const tests = {
    async 'saves an application as APPLIED for a reviewed event'() {
        const db = await fresh(); await addEvent(db);
        const { rows } = await apply(db, 'u1');
        assert.equal(rows[0].status, 'APPLIED');
        assert.deepEqual(rows[0].event_form_answers, { name: 'A' });
    },
    async 'saves as PROCESSING when the event has no review'() {
        const db = await fresh(); await addEvent(db, { needs_review: false });
        assert.equal((await apply(db, 'u1')).rows[0].status, 'PROCESSING');
    },
    async 'rejects before registration opens'() {
        const db = await fresh(); await addEvent(db, { opens: "now() + interval '1 hour'" });
        await fails(apply(db, 'u1'), 'NOT_OPEN');
    },
    async 'is closed exactly at registration_closes (half-open window)'() {
        const db = await fresh(); await addEvent(db, { closes: 'now()' });
        await fails(apply(db, 'u1'), 'CLOSED');
    },
    async 'rejects a disabled event'() {
        const db = await fresh(); await addEvent(db, { disabled: true });
        await fails(apply(db, 'u1'), 'CLOSED');
    },
    async 'rejects a second application from the same student'() {
        const db = await fresh(); await addEvent(db);
        await apply(db, 'u1');
        await fails(apply(db, 'u1'), 'ALREADY_APPLIED');
    },
    async 'rejects an unknown event'() {
        const db = await fresh();
        await fails(apply(db, 'u1'), 'NOT_FOUND');
    },
    async 'counts registered and accepted students as taken seats'() {
        const db = await fresh(); await addEvent(db, { max_attendees: 2 });
        await db.exec(`insert into "Attendee" (user_id, event_id, status) values ('a','${E}','REGISTERED'), ('b','${E}','ACCEPTED'), ('c','${E}','APPLIED')`);
        assert.equal((await db.query(`select seats_taken($1) n`, [E])).rows[0].n, 2);
        await fails(apply(db, 'u1'), 'EVENT_FULL');
    },
    async 'no cap means never full'() {
        const db = await fresh(); await addEvent(db, { max_attendees: null });
        await db.exec(`insert into "Attendee" (user_id, event_id, status) values ('a','${E}','REGISTERED')`);
        assert.equal((await apply(db, 'u1')).rows[0].status, 'APPLIED');
    },
    async 'registers into the last seat and refuses the next one'() {
        const db = await fresh(); await addEvent(db, { max_attendees: 1, needs_review: false });
        const a = (await apply(db, 'u1')).rows[0].attendee_id;
        const b = (await apply(db, 'u2')).rows[0].attendee_id;
        assert.equal((await db.query(`select register_if_seat_available($1, 'pi_1') ok`, [a])).rows[0].ok, true);
        assert.equal((await db.query(`select register_if_seat_available($1, 'pi_2') ok`, [b])).rows[0].ok, false);
        const rows = (await db.query(`select user_id, status, is_payment_verified, payment_id from "Attendee" order by user_id`)).rows;
        assert.deepEqual(rows.map((r) => [r.user_id, r.status, r.is_payment_verified, r.payment_id]), [
            ['u1', 'REGISTERED', true, 'pi_1'],
            ['u2', 'PROCESSING', false, null],
        ]);
    },
    async 'a repeated webhook for a registered student changes nothing'() {
        const db = await fresh(); await addEvent(db, { max_attendees: 1, needs_review: false });
        const a = (await apply(db, 'u1')).rows[0].attendee_id;
        await db.query(`select register_if_seat_available($1, 'pi_1')`, [a]);
        assert.equal((await db.query(`select register_if_seat_available($1, 'pi_1') ok`, [a])).rows[0].ok, true);
        assert.equal((await db.query(`select count(*)::int n from "Attendee" where status = 'REGISTERED'`)).rows[0].n, 1);
    },
    async 'free registration keeps payment fields untouched'() {
        const db = await fresh(); await addEvent(db, { needs_review: false });
        const a = (await apply(db, 'u1')).rows[0].attendee_id;
        await db.query(`select register_if_seat_available($1)`, [a]);
        const r = (await db.query(`select status, is_payment_verified, payment_id from "Attendee"`)).rows[0];
        assert.deepEqual([r.status, r.is_payment_verified, r.payment_id], ['REGISTERED', false, null]);
    },
    async 'students and anon cannot call the functions'() {
        const db = await fresh(); await addEvent(db);
        await db.exec('set role authenticated');
        await fails(apply(db, 'u1'), 'permission denied');
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
