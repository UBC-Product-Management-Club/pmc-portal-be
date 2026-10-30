// Runs the event-day migrations against an in-process Postgres (PGlite) and
// checks each rule, like the other files here. Run with: npm run test:sql
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { PGlite } = require('@electric-sql/pglite');

const MIGRATIONS = ['20261028000000_event_day_schema.sql', '20261029000000_team_rules.sql', '20261030000000_submissions.sql'].map((f) => path.join(__dirname, '../migrations', f));

// A minimal copy of the tables as they are on staging before these migrations
async function fresh() {
    const db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create type "ATTENDEE_STATUS" as enum ('APPLIED','ACCEPTED','PROCESSING','REGISTERED','REJECTED','FAILED');
      create table "User" (user_id varchar primary key, first_name text not null, last_name text not null, email text not null);
      create table "Event" (
        event_id uuid primary key, name text not null default 'PJ', max_attendees int,
        start_time timestamptz, end_time timestamptz);
      create table "Attendee" (
        attendee_id uuid primary key default gen_random_uuid(), user_id varchar not null references "User",
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

// One submission phase whose deadline is the given SQL expression
const addPhase = (db, deadline = "now() + interval '1 day'", starttime = "now() - interval '1 hour'") =>
    db.query(`insert into "Deliverable_Flags" (event_id, starttime, deadline, is_enabled) values ($1, ${starttime}, ${deadline}, true) returning id`, [E])
        .then((r) => r.rows[0].id);

const createTeam = (db, user, name = 'Royal Flush') =>
    db.query(`select create_team($1, $2, $3) t`, [E, user, name]).then((r) => r.rows[0].t);
const joinTeam = (db, user, code) => db.query(`select join_team($1, $2, $3) t`, [E, user, code]).then((r) => r.rows[0].t);
const leaveTeam = (db, user) => db.query(`select leave_team($1, $2)`, [E, user]);
const renameTeam = (db, user, name) => db.query(`select rename_team($1, $2, $3) t`, [E, user, name]).then((r) => r.rows[0].t);
const myTeam = (db, user) => db.query(`select my_team($1, $2) t`, [E, user]).then((r) => r.rows[0].t);
const submitted = (db, teamId) => db.exec(`insert into "Deliverable" (event_id, team_id) values ('${E}', '${teamId}')`);

const FIELDS = [
    { id: 'deck', type: 'file', label: 'Slide deck', required: true, accept: ['application/pdf'], maxSizeMB: 25 },
    { id: 'prototype', type: 'url', label: 'Prototype', required: true },
];
const answers = { deck: 'events/e/teams/t/p/abc/royal-flush.pdf', prototype: 'https://royalflush.app' };
const withFields = (db, phaseId) => db.query(`update "Deliverable_Flags" set fields = $1 where id = $2`, [JSON.stringify(FIELDS), phaseId]);
const save = (db, user, phaseId, version = 0, submission = answers) =>
    db.query(`select save_submission($1, $2, $3, $4, $5) s`, [E, user, phaseId, submission, version]).then((r) => r.rows[0].s);
const context = (db, user, phaseId) => db.query(`select submission_context($1, $2, $3) c`, [E, user, phaseId]).then((r) => r.rows[0].c);

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
    async 'running them twice is harmless'() {
        const db = await fresh();
        for (const file of MIGRATIONS) await db.exec(fs.readFileSync(file, 'utf8'));
    },

    // Teams
    async 'a registered student creates a team with a letter-and-four-digits code'() {
        const db = await fresh(); await eventWith(db, 1);
        const t = await createTeam(db, 'u1', '  Royal Flush ');
        assert.match(t.Team.team_code, /^[A-HJ-NP-Z][0-9]{4}$/);
        assert.equal(t.Team.team_name, 'Royal Flush');
        assert.equal(t.Team.Team_Member.length, 1);
    },
    async 'teammates see the name and email from the application, never the phone'() {
        const db = await fresh(); await eventWith(db, 1);
        const t = await createTeam(db, 'u1');
        const member = t.Team.Team_Member[0].Attendee;
        assert.deepEqual(member.User, { first_name: 'Applied', last_name: 'Name 1', email: 'u1@applied.com' });
        assert.ok(!JSON.stringify(t).includes('604-555'));
    },
    async 'falls back to the profile when the application has no name or email'() {
        const db = await fresh(); await eventWith(db, 1);
        await db.exec(`update "Attendee" set event_form_answers = '{}'`);
        const t = await createTeam(db, 'u1');
        assert.deepEqual(t.Team.Team_Member[0].Attendee.User, { first_name: 'First1', last_name: 'Last1', email: 'u1@profile.com' });
    },
    async 'only registered students can create, join or see a team'() {
        const db = await fresh(); await eventWith(db, 2);
        const { Team: { team_code } } = await createTeam(db, 'u1');
        await db.exec(`update "Attendee" set status = 'ACCEPTED' where user_id = 'u2'`);
        await fails(createTeam(db, 'u2', 'Other'), 'NOT_REGISTERED');
        await fails(joinTeam(db, 'u2', team_code), 'NOT_REGISTERED');
        await fails(myTeam(db, 'u2'), 'NOT_REGISTERED');
        await fails(createTeam(db, 'nobody'), 'NOT_REGISTERED');
    },
    async 'a student can only be on one team'() {
        const db = await fresh(); await eventWith(db, 2);
        const { Team: { team_code } } = await createTeam(db, 'u1');
        await fails(createTeam(db, 'u1', 'Second'), 'ALREADY_ON_TEAM');
        await createTeam(db, 'u2', 'Other');
        await fails(joinTeam(db, 'u2', team_code), 'ALREADY_ON_TEAM');
    },
    async 'team names are 1 to 80 characters with no control characters'() {
        const db = await fresh(); await eventWith(db, 3);
        await createTeam(db, 'u1', 'x'.repeat(80));
        await fails(createTeam(db, 'u2', 'x'.repeat(81)), 'INVALID_TEAM_NAME');
        await fails(createTeam(db, 'u2', '   '), 'INVALID_TEAM_NAME');
        await fails(createTeam(db, 'u2', 'bad\u0007name'), 'INVALID_TEAM_NAME');
        await fails(createTeam(db, 'u3', 'x'.repeat(80)), 'TEAM_NAME_TAKEN');
    },
    async 'joins with a lowercase, spaced code'() {
        const db = await fresh(); await eventWith(db, 2);
        const { Team: { team_code } } = await createTeam(db, 'u1');
        const spaced = ` ${team_code.toLowerCase().slice(0, 2)} ${team_code.slice(2)} `;
        assert.equal((await joinTeam(db, 'u2', spaced)).Team.Team_Member.length, 2);
    },
    async 'a wrong code is NOT_FOUND'() {
        const db = await fresh(); await eventWith(db, 1);
        await fails(joinTeam(db, 'u1', 'Z0000'), 'NOT_FOUND');
    },
    async 'nobody joins a full team'() {
        const db = await fresh(); await eventWith(db, 3, { max: 2 });
        const { Team: { team_code } } = await createTeam(db, 'u1');
        await joinTeam(db, 'u2', team_code);
        await fails(joinTeam(db, 'u3', team_code), 'TEAM_FULL');
        assert.equal((await myTeam(db, 'u1')).Team.Team_Member.length, 2);
    },
    async 'the roster locks once the team has a submission'() {
        const db = await fresh(); await eventWith(db, 3);
        const t = await createTeam(db, 'u1');
        await joinTeam(db, 'u2', t.Team.team_code);
        await submitted(db, t.team_id);
        await fails(joinTeam(db, 'u3', t.Team.team_code), 'ROSTER_LOCKED');
        await fails(leaveTeam(db, 'u2'), 'ROSTER_LOCKED');
    },
    async 'no joining, leaving or creating after the deadline, even with an extension'() {
        const db = await fresh(); await eventWith(db, 3);
        const t = await createTeam(db, 'u1');
        await joinTeam(db, 'u2', t.Team.team_code);
        await addPhase(db, "now() - interval '1 minute'");
        await db.exec(`update "Team" set extended_until = now() + interval '1 hour'`);
        await fails(joinTeam(db, 'u3', t.Team.team_code), 'CLOSED');
        await fails(leaveTeam(db, 'u2'), 'CLOSED');
        await fails(createTeam(db, 'u3', 'Late'), 'CLOSED');
    },
    async 'renaming is allowed until the team deadline, extension included'() {
        const db = await fresh(); await eventWith(db, 1);
        await createTeam(db, 'u1');
        await addPhase(db, "now() - interval '1 minute'");
        await fails(renameTeam(db, 'u1', 'Too Late'), 'CLOSED');
        await db.exec(`update "Team" set extended_until = now() + interval '1 hour'`);
        assert.equal((await renameTeam(db, 'u1', ' Full House ')).Team.team_name, 'Full House');
    },
    async 'renaming needs a team and a free name'() {
        const db = await fresh(); await eventWith(db, 2);
        await createTeam(db, 'u1', 'One');
        await fails(renameTeam(db, 'u2', 'Two'), 'NOT_ON_TEAM');
        await createTeam(db, 'u2', 'Two');
        await fails(renameTeam(db, 'u2', 'One'), 'TEAM_NAME_TAKEN');
    },
    async 'the last member to leave deletes the team'() {
        const db = await fresh(); await eventWith(db, 2);
        const t = await createTeam(db, 'u1');
        await joinTeam(db, 'u2', t.Team.team_code);
        await leaveTeam(db, 'u1');
        assert.equal((await myTeam(db, 'u2')).Team.Team_Member.length, 1);
        await leaveTeam(db, 'u2');
        assert.equal((await db.query(`select count(*)::int n from "Team"`)).rows[0].n, 0);
        await fails(leaveTeam(db, 'u2'), 'NOT_ON_TEAM');
        await fails(myTeam(db, 'u2'), 'NOT_ON_TEAM');
    },
    async 'is_finalist stays hidden until results are published'() {
        const db = await fresh(); await eventWith(db, 1);
        await createTeam(db, 'u1');
        await db.exec(`update "Team" set is_finalist = true`);
        assert.ok(!('is_finalist' in (await myTeam(db, 'u1')).Team));
        await db.exec(`update "Event" set finalists_published_at = now() + interval '1 hour'`);
        assert.ok(!('is_finalist' in (await myTeam(db, 'u1')).Team));
        await db.exec(`update "Event" set finalists_published_at = now() - interval '1 second'`);
        assert.equal((await myTeam(db, 'u1')).Team.is_finalist, true);
    },
    // Submissions
    async 'a team of one saves, and the form sees the file name and who saved it'() {
        const db = await fresh(); await eventWith(db, 1);
        await createTeam(db, 'u1');
        const phase = await addPhase(db); await withFields(db, phase);
        const saved = await save(db, 'u1', phase);
        assert.deepEqual(saved.submission, { deck: 'royal-flush.pdf', prototype: 'https://royalflush.app' });
        assert.equal(saved.version, 1);
        assert.equal(saved.submitted_by, 'Applied Name 1');
        const read = (await db.query(`select team_submission($1, 'u1', $2) s`, [E, phase])).rows[0].s;
        assert.deepEqual(read, saved);
    },
    async 'nothing saved yet reads as null'() {
        const db = await fresh(); await eventWith(db, 1); await createTeam(db, 'u1');
        const phase = await addPhase(db);
        assert.equal((await db.query(`select team_submission($1, 'u1', $2) s`, [E, phase])).rows[0].s, null);
    },
    async 'a save with an old version is STALE, so teammates never overwrite each other'() {
        const db = await fresh(); await eventWith(db, 2);
        const t = await createTeam(db, 'u1'); await joinTeam(db, 'u2', t.Team.team_code);
        const phase = await addPhase(db);
        await save(db, 'u1', phase, 0);
        await fails(save(db, 'u2', phase, 0), 'STALE');
        assert.equal((await save(db, 'u2', phase, 1)).version, 2);
    },
    async 'a save after the deadline is CLOSED and one during an extension counts'() {
        const db = await fresh(); await eventWith(db, 1); await createTeam(db, 'u1');
        const phase = await addPhase(db, "now() - interval '1 minute'");
        await fails(context(db, 'u1', phase), 'CLOSED');
        await fails(save(db, 'u1', phase), 'CLOSED');
        await db.exec(`update "Team" set extended_until = now() + interval '10 minutes'`);
        assert.equal((await save(db, 'u1', phase)).version, 1);
    },
    async 'the deadline is checked against the clock when the save finishes'() {
        const db = await fresh(); await eventWith(db, 1); await createTeam(db, 'u1');
        const phase = await addPhase(db, "now() + interval '200 milliseconds'");
        // One transaction whose now() is still before the deadline when the save runs
        await db.exec('begin');
        await db.exec(`select pg_sleep(0.3)`);
        await fails(save(db, 'u1', phase), 'CLOSED');
        await db.exec('rollback');
    },
    async 'before starttime is NOT_OPEN, and a paused phase is DISABLED'() {
        const db = await fresh(); await eventWith(db, 1); await createTeam(db, 'u1');
        const later = await addPhase(db, "now() + interval '2 days'", "now() + interval '1 day'");
        await fails(save(db, 'u1', later), 'NOT_OPEN');
        const paused = await addPhase(db);
        await db.exec(`update "Deliverable_Flags" set is_enabled = false where id = '${paused}'`);
        await fails(save(db, 'u1', paused), 'DISABLED');
    },
    async 'a team smaller than min_team_size is TEAM_TOO_SMALL'() {
        const db = await fresh(); await eventWith(db, 1, { min: 2 }); await createTeam(db, 'u1');
        const phase = await addPhase(db);
        await fails(save(db, 'u1', phase), 'TEAM_TOO_SMALL');
    },
    async 'only registered members of a team can save or read'() {
        const db = await fresh(); await eventWith(db, 2); await createTeam(db, 'u1');
        const phase = await addPhase(db);
        await fails(save(db, 'u2', phase), 'NOT_ON_TEAM');
        await db.exec(`update "Attendee" set status = 'REJECTED' where user_id = 'u1'`);
        await fails(save(db, 'u1', phase), 'NOT_REGISTERED');
    },
    async 'another event\'s phase is NOT_FOUND'() {
        const db = await fresh(); await eventWith(db, 1); await createTeam(db, 'u1');
        await fails(save(db, 'u1', '99999999-9999-9999-9999-999999999999'), 'NOT_FOUND');
    },
    async 'submission_context returns the team, fields and stored paths'() {
        const db = await fresh(); await eventWith(db, 1); const t = await createTeam(db, 'u1');
        const phase = await addPhase(db); await withFields(db, phase);
        await save(db, 'u1', phase);
        const c = await context(db, 'u1', phase);
        assert.equal(c.team_id, t.team_id);
        assert.equal(c.fields.length, 2);
        assert.equal(c.submission.deck, answers.deck);
    },
    async 'phases carry the team extension and the database time'() {
        const db = await fresh(); await eventWith(db, 1); await createTeam(db, 'u1');
        await addPhase(db);
        await db.exec(`update "Team" set extended_until = '2026-11-22T21:00:00Z'`);
        const [p] = (await db.query(`select submission_phases($1, 'u1') p`, [E])).rows[0].p;
        assert.equal(new Date(p.extended_until).toISOString(), '2026-11-22T21:00:00.000Z');
        assert.ok(Math.abs(new Date(p.server_time) - Date.now()) < 5000);
        assert.deepEqual(p.fields, []);
    },
    async 'students cannot call the team functions directly'() {
        const db = await fresh(); await eventWith(db, 1);
        await db.exec('set role authenticated');
        await fails(createTeam(db, 'u1'), 'permission denied');
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
