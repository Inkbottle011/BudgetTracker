// Tests for scripts/apply-database-setup.mjs: applying the setup files automatically on merge.
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, sql } from './helpers.mjs'
import { applySetup, SETUP_FILES, readSetupFiles } from '../../../scripts/apply-database-setup.mjs'

let h, db, logs
beforeEach(async () => {
    h = await freshDb({ typeCheck: true })
    await h.db.exec(`
        create function auth.jwt() returns jsonb language sql stable
          as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    `)
    db = { exec: s => h.db.exec(s), query: (s, p) => h.rows(s, p) }
    logs = []
})
const log = m => logs.push(m)
const runs = () => h.rows(`select name from public.app_setup_runs order by name`)

describe('applying the database setup', () => {
    it('includes every setup file, in order, and never the one-off or secret ones', () => {
        assert.deepEqual(SETUP_FILES, ['subscriptions/01_setup.sql', 'reimbursements/01_setup.sql', 'bank/01_setup.sql', 'merchants/01_setup.sql'])
    })

    it('applies every setup file the first time, in order', async () => {
        const result = await applySetup(db, readSetupFiles(), log)
        assert.deepEqual(result.applied, SETUP_FILES)
        assert.equal((await runs()).length, 4)
        // Tables from each file exist
        for (const t of ['subscriptions', 'split_shares', 'bank_connections', 'merchant_renames']) {
            assert.ok(await h.one(`select to_regclass('public.${t}') as t`).then(r => r.t), t)
        }
    })

    it('works on a database where the files were already run by hand', async () => {
        for (const f of SETUP_FILES) await h.db.exec(sql(f))
        const result = await applySetup(db, readSetupFiles(), log)
        assert.deepEqual(result.applied, SETUP_FILES)
    })

    it('does nothing the next time, unless a file changed', async () => {
        const files = readSetupFiles()
        await applySetup(db, files, log)
        assert.deepEqual((await applySetup(db, files, log)).applied, [])

        const changed = files.map(f => f.name === 'merchants/01_setup.sql' ? { ...f, sql: f.sql + '\n-- tweak\n' } : f)
        assert.deepEqual((await applySetup(db, changed, log)).applied, ['merchants/01_setup.sql'])
    })

    it('stops at a file that fails, undoing just that file, and says which one', async () => {
        const files = [
            { name: 'a.sql', sql: 'create table public.aa (id int);' },
            { name: 'b.sql', sql: 'create table public.bb (id int); select nonsense from nowhere;' },
            { name: 'c.sql', sql: 'create table public.cc (id int);' },
        ]
        await assert.rejects(applySetup(db, files, log), /b\.sql/)
        assert.ok((await h.one(`select to_regclass('public.aa') as t`)).t)
        assert.equal((await h.one(`select to_regclass('public.bb') as t`)).t, null)
        assert.equal((await h.one(`select to_regclass('public.cc') as t`)).t, null)
        assert.deepEqual(await runs(), [{ name: 'a.sql' }])
    })

    it('the record of what ran is hidden from the app', async () => {
        await applySetup(db, [{ name: 'a.sql', sql: 'select 1;' }], log)
        await h.as('00000000-0000-0000-0000-00000000000a')
        await assert.rejects(h.rows(`select * from public.app_setup_runs`), /permission denied/)
    })
})
