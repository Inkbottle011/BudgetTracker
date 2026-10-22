// Tests for supabase/sql/budget/01_setup.sql: the order of budget items.
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, sql } from './helpers.mjs'

let h
beforeEach(async () => { h = await freshDb() })

const makeBudgetItems = () => h.db.exec(`
    create table public.budget_items (id uuid primary key default gen_random_uuid(), user_id uuid, name text, type text, created_at timestamptz default now());
`)

describe('budget item order', () => {
    it('adds a position to budget items, and can be set up more than once', async () => {
        await makeBudgetItems()
        await h.db.exec(sql('budget/01_setup.sql'))
        await h.db.exec(sql('budget/01_setup.sql'))
        const cols = await h.rows(`select column_name, is_nullable from information_schema.columns where table_name = 'budget_items' and column_name = 'position'`)
        assert.deepEqual(cols, [{ column_name: 'position', is_nullable: 'YES' }])
    })

    it('does nothing (and does not fail) where there is no budget table yet', async () => {
        await h.db.exec(sql('budget/01_setup.sql'))
        assert.equal((await h.one(`select to_regclass('public.budget_items') as t`)).t, null)
    })
})
