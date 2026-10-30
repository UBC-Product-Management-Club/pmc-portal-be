// Runs the event-day migrations against an in-process Postgres (PGlite) and
// checks each rule, like the other files here. Run with: npm run test:sql
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { PGlite } = require('@electric-sql/pglite');

const MIGRATIONS = ['20261028000000_event_day_schema.sql'].map((f) => path.join(__dirname, '../migrations', f));

// A minimal copy of the tables as they are on staging before these migrations
async function fresh() {
    const db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create type "ATTENDEE_STATUS" as enum ('APPLIED','ACCEPTED','PROCESSING','REGISTERED','REJECTED','FAILED');
      create table "User" (user_id text primary key, first_name text not null, last_name text not null, email text not null);
      create table "Event" (
        event_id uuid primary key, name text not null default 'PJ', max_attendees int,
        start_time timestamptz, end_time timestamptz);
      create table "Attendee" (
        attendee_id uuid primary key default gen_random_uuid(), user_id text not null references "User",
        event_id uuid not null references "Event", event_form_answers jsonb, status "ATTENDEE_STATUS",
        created_at timestamptz default now());
      create table "Team" (
        team_id uuid primary key default gen_random_uuid(), event_id uuid not null references "Event",
        team_name text not null, team_code text default '' unique);
      create unique index "Team_event_id_team_name_idx" on "Team" (event_id, team_name);
      create table "Team_Member" (
        team_id uuid not null references "Team" on delete cascade,
        attendee_id uuid not null references "Attendee" on delete cascade,
        primary key (team_id, attendee_id));
      create table "Deliverable_Flags" (
        id uuid primary key default gen_random_uuid(), event_id uuid not null references "Event",
        starttime timestamptz, deadline timestamptz not null, is_enabled boolean not null);
      create table "Deliverable" (
        deliverable_id uuid primary key default gen_random_uuid(), event_id uuid not null references "Event",
        team_id uuid not null references "Team" on delete cascade, phase_id varchar not null default 'discovery',
        submission jsonb, submitted_at timestamptz, submitted_by varchar references "User", title text,
        created_at timestamptz default now(), unique (event_id, team_id, phase_id));
    `);
    for (const file of MIGRATIONS) await db.exec(fs.readFileSync(file, 'utf8'));
    return db;
}

const E = '11111111-1111-1111-1111-111111111111';

// An event with registered students u1..uN, and their attendee ids
async function eventWith(db, count, event = {}) {
    const f = { min: 1, max: 4, ...event };
    await db.exec(`insert into "Event" (event_id, min_team_size, max_team_size) values ('${E}', ${f.min}, ${f.max})`);
    const ids = [];
    for (let i = 1; i <= count; i++) {
        await db.exec(`insert into "User" values ('u${i}', 'First${i}', 'Last${i}', 'u${i}@profile.com')`);
        const { rows } = await db.query(
            `insert into "Attendee" (user_id, event_id, status, event_form_answers) values ($1, $2, 'REGISTERED', $3) returning attendee_id`,
            [`u${i}`, E, { name: `Applied Name ${i}`, email: `u${i}@applied.com`, phone: '604-555-0123' }]
        );
        ids.push(rows[0].attendee_id);
    }
    return ids;
}

const fails = async (p, code) => {
    try { await p; } catch (e) { assert.ok(e.message.includes(code), `expected ${code}, got ${e.message}`); return; }
    assert.fail(`expected ${code}`);
};

const tests = {
    async 'team sizes must make sense'() {
        const db = await fresh();
        await fails(db.exec(`insert into "Event" (event_id, min_team_size, max_team_size) values ('${E}', 3, 2)`), 'event_team_size_check');
        await fails(db.exec(`insert into "Event" (event_id, min_team_size) values ('${E}', 0)`), 'event_team_size_check');
    },
    async 'the Discord link must be https'() {
        const db = await fresh();
        await fails(db.exec(`insert into "Event" (event_id, discord_url) values ('${E}', 'javascript:alert(1)')`), 'event_discord_url_check');
    },
    async 'an attendee can only be on one team'() {
        const db = await fresh(); const [a] = await eventWith(db, 1);
        await db.exec(`insert into "Team" (team_id, event_id, team_name, team_code) values
          ('aaaaaaaa-0000-0000-0000-000000000001', '${E}', 'One', 'A1111'),
          ('aaaaaaaa-0000-0000-0000-000000000002', '${E}', 'Two', 'A2222')`);
        await db.exec(`insert into "Team_Member" values ('aaaaaaaa-0000-0000-0000-000000000001', '${a}')`);
        await fails(db.exec(`insert into "Team_Member" values ('aaaaaaaa-0000-0000-0000-000000000002', '${a}')`), 'team_member_attendee_key');
    },
    async 'stops when an attendee is already on two teams'() {
        const db = new PGlite();
        await db.exec(`
          create table "Event" (event_id uuid primary key); create table "Team" (team_id uuid primary key);
          create table "Deliverable_Flags" (id uuid primary key); create table "Deliverable" (deliverable_id uuid primary key);
          create table "Team_Member" (team_id uuid, attendee_id uuid, primary key (team_id, attendee_id));
          insert into "Team_Member" values (gen_random_uuid(), '${E}'), (gen_random_uuid(), '${E}');`);
        await fails(db.exec(fs.readFileSync(MIGRATIONS[0], 'utf8')), 'more than one team');
    },
    async 'running it twice is harmless'() {
        const db = await fresh();
        await db.exec(fs.readFileSync(MIGRATIONS[0], 'utf8'));
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
