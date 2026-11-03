// Tests for supabase/sql/forum/01_setup.sql: the suggestions forum.
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { freshDb, sql, ALICE, BOB } from './helpers.mjs'

const MOD = '00000000-0000-0000-0000-0000000000dd'
let h
beforeEach(async () => {
    h = await freshDb()
    await h.db.exec(`insert into auth.users values ('${MOD}')`)
    await h.db.exec(sql('forum/01_setup.sql'))
    await h.as('job')
    await h.db.exec(`insert into public.forum_moderators (user_id) values ('${MOD}')`)
})
const post = async (who, fields = {}) => { await h.as(who); return h.insert('forum_posts', { kind: 'idea', title: 'Budget templates', body: 'Like 50/30/20', ...fields }) }

describe('forum', () => {
    it('can be set up more than once', async () => {
        await h.db.exec(sql('forum/01_setup.sql'))
    })

    it('everyone signed in sees every post, reply and upvote', async () => {
        const p = await post(ALICE)
        await h.as(BOB)
        await h.insert('forum_replies', { post_id: p, body: 'Yes please' })
        await h.db.query(`insert into forum_votes (post_id) values ($1)`, [p])
        await h.as(ALICE)
        assert.deepEqual(await h.rows(`select title, user_id, status, by_moderator from forum_posts`), [{ title: 'Budget templates', user_id: ALICE, status: 'open', by_moderator: false }])
        assert.deepEqual(await h.rows(`select body, user_id from forum_replies`), [{ body: 'Yes please', user_id: BOB }])
        assert.deepEqual(await h.rows(`select user_id from forum_votes`), [{ user_id: BOB }])
    })

    it('signed-out visitors see and send nothing', async () => {
        await post(ALICE)
        await h.as('anon')
        await assert.rejects(h.rows(`select * from forum_posts`))
        await assert.rejects(h.insert('forum_posts', { kind: 'idea', title: 'Spam' }))
    })

    it('you post, reply and vote only as yourself, and vote once per post', async () => {
        const p = await post(ALICE)
        await h.as(BOB)
        await assert.rejects(h.insert('forum_posts', { user_id: ALICE, kind: 'idea', title: 'Pretending' }))
        await assert.rejects(h.insert('forum_replies', { user_id: ALICE, post_id: p, body: 'Pretending' }))
        await h.db.query(`insert into forum_votes (post_id) values ($1)`, [p])
        await assert.rejects(h.db.query(`insert into forum_votes (post_id) values ($1)`, [p]))
        await assert.rejects(h.db.query(`insert into forum_votes (post_id, user_id) values ($1, $2)`, [p, ALICE]))
        await h.db.query(`delete from forum_votes where post_id = $1`, [p])   // take it back
        assert.deepEqual(await h.rows(`select * from forum_votes`), [])
    })

    it('you can edit and delete your own posts and replies (deleting can be undone), not other people\'s', async () => {
        const p = await post(ALICE)
        await h.as(BOB)
        await h.db.query(`update forum_posts set title = 'Hacked' where id = $1`, [p])
        await h.db.query(`update forum_posts set deleted_at = now() where id = $1`, [p])
        await h.as(ALICE)
        assert.deepEqual(await h.rows(`select title, deleted_at from forum_posts`), [{ title: 'Budget templates', deleted_at: null }])
        await h.db.query(`update forum_posts set title = 'Budget templates (50/30/20)' where id = $1`, [p])
        await h.db.query(`update forum_posts set deleted_at = now() where id = $1`, [p])
        await h.as(BOB)
        assert.deepEqual(await h.rows(`select * from forum_posts`), [], 'deleted posts disappear for everyone else')
        await h.as(ALICE)
        await h.db.query(`update forum_posts set deleted_at = null where id = $1`, [p])   // Undo
        await h.as(BOB)
        assert.equal((await h.rows(`select title from forum_posts`))[0].title, 'Budget templates (50/30/20)')
    })

    it('only moderators set a status or hide things, and their replies are marked', async () => {
        const p = await post(ALICE)
        await h.as(ALICE)
        await h.db.query(`update forum_posts set status = 'done', hidden = true where id = $1`, [p]).catch(() => {})
        await assert.rejects(h.db.query(`select moderate_post($1, 'done', false)`, [p]))
        assert.deepEqual(await h.rows(`select status, hidden from forum_posts`), [{ status: 'open', hidden: false }])

        await h.as(MOD)
        await h.db.query(`select moderate_post($1, 'planned', false)`, [p])
        const r = await h.insert('forum_replies', { post_id: p, body: 'On the list for next month' })
        assert.deepEqual(await h.rows(`select status from forum_posts`), [{ status: 'planned' }])
        assert.deepEqual(await h.rows(`select by_moderator from forum_replies where id = $1`, [r]), [{ by_moderator: true }])
        assert.deepEqual(await h.rows(`select is_forum_moderator() as m`), [{ m: true }])
        await h.as(BOB)
        assert.deepEqual(await h.rows(`select is_forum_moderator() as m`), [{ m: false }])
    })

    it('hidden posts and replies disappear for everyone but their author and moderators', async () => {
        const p = await post(ALICE)
        await h.as(BOB)
        const r = await h.insert('forum_replies', { post_id: p, body: 'Spam reply' })
        await h.as(MOD)
        await h.db.query(`select moderate_reply($1, true)`, [r])
        await h.as(ALICE)
        assert.deepEqual(await h.rows(`select * from forum_replies`), [])
        await h.as(BOB)
        assert.equal((await h.rows(`select body from forum_replies`)).length, 1, 'the author still sees it')
        await h.as(MOD)
        assert.equal((await h.rows(`select body from forum_replies`)).length, 1, 'moderators still see it')
    })

    it('posts and replies need text of a sensible length', async () => {
        await h.as(ALICE)
        await assert.rejects(h.insert('forum_posts', { kind: 'idea', title: '   ' }))
        await assert.rejects(h.insert('forum_posts', { kind: 'idea', title: 'x'.repeat(121) }))
        await assert.rejects(h.insert('forum_posts', { kind: 'rant', title: 'Hi' }))
        const p = await post(ALICE)
        await assert.rejects(h.insert('forum_replies', { post_id: p, body: '' }))
        await assert.rejects(h.insert('forum_replies', { post_id: p, body: 'x'.repeat(2001) }))
    })

    it('the moderators list is private, and nobody can add themselves', async () => {
        await h.as(BOB)
        await assert.rejects(h.db.query(`insert into forum_moderators (user_id) values ($1)`, [BOB]))
        assert.deepEqual(await h.rows(`select * from forum_moderators`), [])
    })
})
