// Runs the registration-checks, applicant-review and ops-tooling migrations
// against an in-process Postgres (PGlite) and checks each rule, including the
// supabase/queries files. The setup below is a minimal copy of the tables they
// touch; add new tables there when a migration needs them. Run with: npm run test:sql
const fs = require('fs');
const assert = require('assert');
const { PGlite } = require('@electric-sql/pglite');

const DIR = require('path').join(__dirname, '../migrations/') + '/';
const PR1 = fs.readFileSync(DIR + '20261025000000_register_checks.sql', 'utf8');
const PR2 = fs.readFileSync(DIR + '20261026000000_applicant_review.sql', 'utf8');
const PR5 = fs.readFileSync(DIR + '20261027000000_ops_tooling.sql', 'utf8');
const query = (name) => fs.readFileSync(DIR + '../queries/' + name, 'utf8').replace(/'<event_id>'/g, `'${E}'`);

async function base() {
    const db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create type "ATTENDEE_STATUS" as enum ('FAILED','PROCESSING','APPLIED','REGISTERED','ACCEPTED');
      create table "User" (user_id text primary key, is_payment_verified boolean, email text);
      create table "Payment" (payment_id text primary key, amount int);
      create table "Event" (
        event_id uuid primary key, name text, max_attendees int, needs_review boolean not null default true,
        is_disabled boolean default false, registration_opens timestamptz, registration_closes timestamptz,
        member_price numeric, non_member_price numeric);
      create table "Attendee" (
        attendee_id uuid primary key default gen_random_uuid(), user_id text not null references "User",
        event_id uuid not null references "Event", event_form_answers jsonb,
        is_payment_verified boolean not null default false, payment_id text,
        status "ATTENDEE_STATUS", created_at timestamptz default now());
      create table "Checkout_Session" (
        attendee_id uuid primary key references "Attendee", checkout_id text not null,
        expires_at timestamptz default now());
      create table "Drafts" (user_id text, event_id uuid, draft_data jsonb, primary key (user_id, event_id));
    `);
    await db.exec(PR1);
    return db;
}

async function fresh() {
    const db = await base();
    // The real run splits off the enum statement; PGlite's exec is one transaction too
    const [first, ...rest] = PR2.split(/^alter type .*$/m);
    await db.exec(`alter type "ATTENDEE_STATUS" add value if not exists 'REJECTED'`);
    await db.exec(first + rest.join(''));
    await db.exec(PR5);
    return db;
}

const E = '11111111-1111-1111-1111-111111111111';
const addEvent = (db, f = {}) => {
    f = { cap: 2, review: true, hold: 72, ...f };
    return db.exec(`insert into "Event" (event_id, name, max_attendees, needs_review, registration_opens, registration_closes, member_price, non_member_price, payment_hold_hours)
                    values ('${E}', 'PJ', ${f.cap ?? 'null'}, ${f.review}, now() - interval '1 day', now() + interval '1 day', 8.55, 12, ${f.hold})`);
};
const apply = async (db, user, member = false) => {
    await db.query(`insert into "User" values ($1, $2, $1 || '@x.com') on conflict do nothing`, [user, member]);
    return (await db.query(`select * from submit_application($1, $2, $3::jsonb)`, [E, user, JSON.stringify({ name: 'N ' + user, email: user + '@x.com' })])).rows[0].attendee_id;
};
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
const accept = (db, ids) => one(db, `select accept_applicants($1, $2::uuid[], 'tech') n`, [E, ids]).then((r) => r.n);
const reopen = (db, ids) => one(db, `select reopen_payment_window($1, $2::uuid[], 'tech') n`, [E, ids]).then((r) => r.n);
const reject = (db, ids) => one(db, `select reject_applicants($1, $2::uuid[], 'tech') n`, [E, ids]).then((r) => r.n);
const status = (db, id) => one(db, `select status from "Attendee" where attendee_id = $1`, [id]).then((r) => r.status);
const hooks = (db, id) => db.query(`select type, acceptance_version v, cancel_reason from "Notification_Hook" where attendee_id = $1 order by created_at, type`, [id]).then((r) => r.rows);
// Moves an accepted student's deadline into the past (or future) by this many minutes
const shiftDeadline = (db, id, minutes) => db.query(`update "Attendee" set payment_due_at = now() + make_interval(mins => $2) where attendee_id = $1`, [id, minutes]);
const checkout = async (db, id, cs) => {
    const v = (await one(db, `select acceptance_version v from "Attendee" where attendee_id = $1`, [id])).v;
    await db.query(`insert into "Checkout_Session" (attendee_id, checkout_id, acceptance_version) values ($1, $2, $3)
                    on conflict (attendee_id) do update set checkout_id = excluded.checkout_id, acceptance_version = excluded.acceptance_version,
                      fulfilled_at = null, fulfilled_event_id = null, refund_id = null, attention_reason = null`, [id, cs, v]);
};
const fulfill = (db, cs, { paid = true, at = 'now()', evt = 'evt_1' } = {}) =>
    one(db, `select fulfill_event_checkout($1, $2, $3, ${at}, 'pi_' || $1) r`, [cs, evt, paid]).then((r) => r.r);
const fails = async (p, code) => {
    try { await p; } catch (e) { assert.ok(e.message.includes(code), `expected ${code}, got ${e.message}`); return e; }
    assert.fail(`expected ${code}`);
};

const tests = {
    async 'the migration runs twice without errors'() {
        const db = await fresh();
        await db.exec(PR2.replace(/^alter type .*$/m, ''));
    },
    async 'a reviewed application records one receipt hook'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1');
        assert.deepEqual(await hooks(db, a), [{ type: 'application_received', v: 0, cancel_reason: null }]);
    },
    async 'an event without review records no hook'() {
        const db = await fresh(); await addEvent(db, { review: false });
        assert.deepEqual(await hooks(db, await apply(db, 'u1')), []);
    },
    async 'accept sets the deadline, version and hooks and drops the unsent receipt'() {
        const db = await fresh(); await addEvent(db, { hold: 72 });
        const a = await apply(db, 'u1', true);
        assert.equal(await accept(db, [a]), 1);
        const r = await one(db, `select status, reviewed_by, acceptance_version, round(extract(epoch from payment_due_at - now()) / 3600) h from "Attendee"`);
        assert.deepEqual([r.status, r.reviewed_by, r.acceptance_version, Number(r.h)], ['ACCEPTED', 'tech', 1, 72]);
        assert.deepEqual(await hooks(db, a), [
            { type: 'application_received', v: 0, cancel_reason: 'decided' },
            { type: 'accepted', v: 1, cancel_reason: null },
            { type: 'reminder', v: 1, cancel_reason: null },
        ]);
        const h = await one(db, `select payload, eligible_at = (select payment_due_at - interval '24 hours' from "Attendee") due from "Notification_Hook" where type = 'reminder'`);
        assert.equal(h.due, true);
        assert.equal(h.payload.event_path, `/events/${E}`);
        assert.equal(h.payload.recipient_email, 'u1@x.com');
        assert.equal(Number(h.payload.amount_due), 8.55);
    },
    async 'a non-member hook carries the non-member price'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1', false);
        await accept(db, [a]);
        assert.equal(Number((await one(db, `select payload from "Notification_Hook" where type = 'accepted'`)).payload.amount_due), 12);
    },
    async 'accepting into the last seat works and the next accept is refused'() {
        const db = await fresh(); await addEvent(db, { cap: 1 });
        const a = await apply(db, 'u1');
        const b = await apply(db, 'u2');   // both applied while the seat was free
        assert.equal(await accept(db, [a]), 1);
        await fails(accept(db, [b]), '0 seats left, 1 selected');
        assert.equal(await status(db, b), 'APPLIED');
    },
    async 'an oversize selection changes nobody and says how many seats are left'() {
        const db = await fresh(); await addEvent(db, { cap: 2 });
        const ids = [await apply(db, 'u1'), await apply(db, 'u2')];
        await db.exec(`update "Event" set max_attendees = 1`);
        const e = await fails(accept(db, ids), 'EVENT_FULL');
        assert.ok(e.message.includes('1 seats left, 2 selected'), e.message);
        assert.deepEqual([await status(db, ids[0]), await status(db, ids[1])], ['APPLIED', 'APPLIED']);
    },
    async 'running accept again is harmless'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1');
        await accept(db, [a]);
        assert.equal(await accept(db, [a]), 0);
        const r = await one(db, `select acceptance_version v from "Attendee"`);
        assert.equal(r.v, 1);
        assert.equal((await hooks(db, a)).length, 3);
    },
    async 'seats free up only an hour after the deadline'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1');
        await accept(db, [a]);
        await shiftDeadline(db, a, -30);
        assert.equal((await one(db, `select seats_taken($1) n`, [E])).n, 1);
        await shiftDeadline(db, a, -61);
        assert.equal((await one(db, `select seats_taken($1) n`, [E])).n, 0);
    },
    async 'reopen only touches students past their deadline and grace, and bumps the version'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1');
        await accept(db, [a]);
        assert.equal(await reopen(db, [a]), 0);   // still inside the window
        await shiftDeadline(db, a, -61);
        assert.equal(await reopen(db, [a]), 1);
        assert.equal((await one(db, `select acceptance_version v from "Attendee"`)).v, 2);
        const rows = await hooks(db, a);
        assert.deepEqual(rows.filter((h) => h.type !== 'application_received'), [
            { type: 'accepted', v: 1, cancel_reason: 'new_window' },
            { type: 'reminder', v: 1, cancel_reason: 'new_window' },
            { type: 'accepted', v: 2, cancel_reason: null },
            { type: 'reminder', v: 2, cancel_reason: null },
        ]);
    },
    async 'reopen checks the cap too'() {
        const db = await fresh(); await addEvent(db, { cap: 1 });
        const a = await apply(db, 'u1');
        await accept(db, [a]);
        await shiftDeadline(db, a, -61);
        const b = await apply(db, 'u2');      // the seat is free again, so u2 applies
        await accept(db, [b]);
        await fails(reopen(db, [a]), 'EVENT_FULL');
    },
    async 'reject records a rejected hook and cancels the pending ones'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1');
        await accept(db, [a]);
        assert.equal(await reject(db, [a]), 1);
        assert.equal(await reject(db, [a]), 0);
        assert.equal(await status(db, a), 'REJECTED');
        const rows = await hooks(db, a);
        assert.deepEqual(rows.map((h) => [h.type, h.cancel_reason]), [
            ['application_received', 'decided'], ['accepted', 'rejected'], ['reminder', 'rejected'], ['rejected', null],
        ]);
    },
    async 'sent hooks stay as history'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1');
        await accept(db, [a]);
        await db.exec(`update "Notification_Hook" set sent_at = now() where type = 'accepted'`);
        await reject(db, [a]);
        assert.equal((await one(db, `select cancelled_at from "Notification_Hook" where type = 'accepted'`)).cancelled_at, null);
    },
    async 'an on-time payment registers once and cancels the pending hooks'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1');
        await accept(db, [a]);
        await checkout(db, a, 'cs_1');
        assert.equal(await fulfill(db, 'cs_1'), 'REGISTERED');
        assert.equal(await fulfill(db, 'cs_1', { evt: 'evt_2' }), 'ALREADY_FULFILLED');
        const r = await one(db, `select a.status, a.is_payment_verified, a.payment_id, c.fulfilled_event_id from "Attendee" a join "Checkout_Session" c using (attendee_id)`);
        assert.deepEqual([r.status, r.is_payment_verified, r.payment_id, r.fulfilled_event_id], ['REGISTERED', true, 'pi_cs_1', 'evt_1']);
        assert.deepEqual((await hooks(db, a)).filter((h) => h.type !== 'application_received').map((h) => h.cancel_reason), ['registered', 'registered']);
    },
    async 'an unpaid checkout changes nothing'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1');
        await accept(db, [a]);
        await checkout(db, a, 'cs_1');
        assert.equal(await fulfill(db, 'cs_1', { paid: false }), 'UNPAID');
        assert.equal(await status(db, a), 'ACCEPTED');
        assert.equal(await fulfill(db, 'cs_1'), 'REGISTERED');
    },
    async 'an unknown checkout is NOT_FOUND'() {
        const db = await fresh(); await addEvent(db);
        assert.equal(await fulfill(db, 'cs_nope'), 'NOT_FOUND');
    },
    async 'a payment completed after the deadline is LATE_PAYMENT, and stays that way'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1');
        await accept(db, [a]);
        await checkout(db, a, 'cs_1');
        await shiftDeadline(db, a, -10);
        assert.equal(await fulfill(db, 'cs_1'), 'LATE_PAYMENT');
        assert.equal(await fulfill(db, 'cs_1'), 'LATE_PAYMENT');   // so a failed refund is retried
        assert.equal(await status(db, a), 'ACCEPTED');
        const c = await one(db, `select attention_reason r, payment_id from "Checkout_Session"`);
        assert.deepEqual([c.r, c.payment_id], ['LATE_PAYMENT', 'pi_cs_1']);
    },
    async 'an on-time payment confirmed inside the grace hour registers'() {
        const db = await fresh(); await addEvent(db, { cap: 1 });
        const a = await apply(db, 'u1');
        await accept(db, [a]);
        await checkout(db, a, 'cs_1');
        await shiftDeadline(db, a, -30);
        assert.equal(await fulfill(db, 'cs_1', { at: "now() - interval '45 minutes'" }), 'REGISTERED');
    },
    async 'after the grace hour an on-time payment registers only if a seat is free'() {
        const db = await fresh(); await addEvent(db, { cap: 1 });
        const a = await apply(db, 'u1');
        await accept(db, [a]);
        await checkout(db, a, 'cs_1');
        await shiftDeadline(db, a, -90);
        const b = await apply(db, 'u2');
        await accept(db, [b]);
        assert.equal(await fulfill(db, 'cs_1', { at: "now() - interval '100 minutes'" }), 'EVENT_FULL_LATE');
    },
    async 'after the grace hour with a seat free it still registers'() {
        const db = await fresh(); await addEvent(db, { cap: 1 });
        const a = await apply(db, 'u1');
        await accept(db, [a]);
        await checkout(db, a, 'cs_1');
        await shiftDeadline(db, a, -90);
        assert.equal(await fulfill(db, 'cs_1', { at: "now() - interval '100 minutes'" }), 'REGISTERED');
    },
    async 'a checkout from an earlier acceptance never registers'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1');
        await accept(db, [a]);
        await checkout(db, a, 'cs_1');
        await shiftDeadline(db, a, -61);
        await reopen(db, [a]);
        assert.equal(await fulfill(db, 'cs_1', { at: "now() - interval '90 minutes'" }), 'OLD_ACCEPTANCE');
    },
    async 'a rejected student is refunded'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1');
        await accept(db, [a]);
        await checkout(db, a, 'cs_1');
        await reject(db, [a]);
        assert.equal(await fulfill(db, 'cs_1'), 'REJECTED');
        assert.equal(await status(db, a), 'REJECTED');
    },
    async 'a no-review payment takes a free seat, and is refused once full'() {
        const db = await fresh(); await addEvent(db, { cap: 1, review: false });
        const a = await apply(db, 'u1');
        const b = await apply(db, 'u2');
        await checkout(db, a, 'cs_1');
        await checkout(db, b, 'cs_2');
        assert.equal(await fulfill(db, 'cs_1'), 'REGISTERED');
        assert.equal(await fulfill(db, 'cs_2'), 'NO_REVIEW_FULL');
        assert.equal(await status(db, b), 'FAILED');
    },
    async 'a second application from the same student is blocked by the table too'() {
        const db = await fresh(); await addEvent(db);
        await apply(db, 'u1');
        await fails(db.exec(`insert into "Attendee" (user_id, event_id, status) values ('u1', '${E}', 'APPLIED')`), 'duplicate key');
    },
    async 'the migration refuses to run over duplicate applications'() {
        const db = await base(); await db.exec(`alter type "ATTENDEE_STATUS" add value 'REJECTED'`);
        await db.exec(`insert into "Event" (event_id, name) values ('${E}', 'PJ'); insert into "User" values ('u1', false);
                       insert into "Attendee" (user_id, event_id) values ('u1', '${E}'), ('u1', '${E}')`);
        await fails(db.exec(PR2.replace(/^alter type .*$/m, '')), 'Duplicate Attendee rows');
    },
    async 'the review sheet lists every applicant with their deadline and sends'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1'); await apply(db, 'u2');
        await accept(db, [a]);
        await db.exec(`update "Notification_Hook" set sent_at = now() where type = 'accepted'`);
        const { rows } = await db.query(query('review_sheet.sql'));
        assert.deepEqual(rows.map((r) => [r.email, r.status, !!r.payment_due_at, !!r.acceptance_sent_at]), [
            ['u1@x.com', 'ACCEPTED', true, true],
            ['u2@x.com', 'APPLIED', false, false],
        ]);
    },
    async 'who-to-message follows the sending rules'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1'); const b = await apply(db, 'u2'); await apply(db, 'u3');
        await accept(db, [a]); await reject(db, [b]);
        const due = async () => (await db.query(query('who_to_message.sql'))).rows.map((r) => [r.email, r.type]).sort();
        // u3's receipt, u1's acceptance, u2's rejection; u1's reminder isn't due for two days
        assert.deepEqual(await due(), [['u1@x.com', 'accepted'], ['u2@x.com', 'rejected'], ['u3@x.com', 'application_received']]);
        // Once the acceptance is sent and the reminder's time comes, the reminder is due
        await db.exec(`update "Notification_Hook" set sent_at = now() - interval '1 day' where type = 'accepted';
                       update "Notification_Hook" set eligible_at = now() - interval '1 minute' where type = 'reminder'`);
        assert.deepEqual((await due()).filter(([e]) => e === 'u1@x.com'), [['u1@x.com', 'reminder']]);
    },
    async 'payment issues lists unresolved refunds with what was paid'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1');
        await accept(db, [a]);
        await checkout(db, a, 'cs_1');
        await reject(db, [a]);
        await db.exec(`insert into "Payment" values ('pi_cs_1', 1200)`);
        await fulfill(db, 'cs_1');
        await db.exec(`update "Checkout_Session" set refund_id = 're_1'`);
        let { rows } = await db.query(query('payment_issues.sql'));
        assert.deepEqual(rows.map((r) => [r.email, r.amount_cents, r.payment_id, r.refund_id, r.attention_reason]), [
            ['u1@x.com', 1200, 'pi_cs_1', 're_1', 'REJECTED'],
        ]);
        await db.exec(`update "Checkout_Session" set attention_resolved_at = now()`);
        assert.equal((await db.query(query('payment_issues.sql'))).rows.length, 0);
    },
    async 'students cannot call the functions'() {
        const db = await fresh(); await addEvent(db);
        const a = await apply(db, 'u1');
        await db.exec('set role authenticated');
        await fails(accept(db, [a]), 'permission denied');
        await fails(fulfill(db, 'cs_1'), 'permission denied');
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
