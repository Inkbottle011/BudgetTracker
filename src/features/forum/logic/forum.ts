// The suggestions forum: posts, replies and upvotes shared by everyone using the app.
// Owns forum_posts, forum_replies, forum_votes and forum_moderators.
import { supabase } from '../../../shared/supabase'

export type PostKind = 'idea' | 'problem' | 'other'
export type PostStatus = 'open' | 'planned' | 'done' | 'wont_do'
export type Sort = 'top' | 'new'
export type KindFilter = 'all' | 'idea' | 'problem'

export interface Post {
    id: string; user_id: string; kind: PostKind; title: string; body: string
    status: PostStatus; hidden: boolean; by_moderator: boolean; deleted_at: string | null; created_at: string
}
export interface Reply {
    id: string; post_id: string; user_id: string; body: string
    hidden: boolean; by_moderator: boolean; deleted_at: string | null; created_at: string
}
export interface Vote { post_id: string; user_id: string }
export interface Thread extends Post { votes: number; votedByMe: boolean; replies: Reply[] }

export const MAX_TITLE = 120
export const MAX_BODY = 2000
export const KIND_LABELS: Record<PostKind, string> = { idea: 'Idea', problem: 'Problem', other: 'Other' }
export const STATUS_LABELS: Record<PostStatus, string> = { open: 'Open', planned: 'Planned', done: 'Done', wont_do: 'Not planned' }

/** How someone appears: "You", or "Member" and four letters that stay the same on all their posts. */
export function memberName(userId: string, me: string | null): string {
    if (me && userId === me) return 'You'
    return `Member ${userId.replace(/-/g, '').slice(-4).toUpperCase()}`
}

/** Posts with their upvotes and replies, filtered and sorted. Your deleted posts are left out. */
export function buildThreads(posts: Post[], replies: Reply[], votes: Vote[], me: string | null, sort: Sort, kind: KindFilter): Thread[] {
    const threads = posts
        .filter(p => !p.deleted_at && (kind === 'all' || p.kind === kind))
        .map(p => ({
            ...p,
            votes: votes.filter(v => v.post_id === p.id).length,
            votedByMe: !!me && votes.some(v => v.post_id === p.id && v.user_id === me),
            replies: replies.filter(r => r.post_id === p.id && !r.deleted_at).sort((a, b) => a.created_at.localeCompare(b.created_at)),
        }))
    const newest = (a: Thread, b: Thread) => b.created_at.localeCompare(a.created_at)
    return threads.sort(sort === 'new' ? newest : (a, b) => b.votes - a.votes || newest(a, b))
}

// ---- Talking to the database ----

const fail = (what: string, error: { message: string } | null) => { if (error) throw new Error(`Couldn't ${what}: ${error.message}`) }

export async function myUserId(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user.id ?? null
}

export async function loadForum(): Promise<{ posts: Post[]; replies: Reply[]; votes: Vote[]; moderator: boolean }> {
    const [p, r, v, m] = await Promise.all([
        supabase.from('forum_posts').select('*').order('created_at', { ascending: false }),
        supabase.from('forum_replies').select('*').order('created_at'),
        supabase.from('forum_votes').select('post_id, user_id'),
        supabase.rpc('is_forum_moderator'),
    ])
    fail('load the forum', p.error ?? r.error ?? v.error)
    return { posts: (p.data ?? []) as Post[], replies: (r.data ?? []) as Reply[], votes: (v.data ?? []) as Vote[], moderator: m.data === true }
}

export async function createPost(kind: PostKind, title: string, body: string) {
    fail('post that', (await supabase.from('forum_posts').insert({ kind, title: title.trim(), body: body.trim() })).error)
}

export async function editPost(id: string, kind: PostKind, title: string, body: string) {
    fail('save your changes', (await supabase.from('forum_posts').update({ kind, title: title.trim(), body: body.trim() }).eq('id', id)).error)
}

/** Deleting only hides it (for everyone else), so it can be undone. */
export async function setPostDeleted(id: string, deleted: boolean) {
    fail(deleted ? 'delete it' : 'bring it back', (await supabase.from('forum_posts').update({ deleted_at: deleted ? new Date().toISOString() : null }).eq('id', id)).error)
}

export async function setVote(postId: string, me: string, on: boolean) {
    const res = on
        ? await supabase.from('forum_votes').insert({ post_id: postId })
        : await supabase.from('forum_votes').delete().eq('post_id', postId).eq('user_id', me)
    fail(on ? 'upvote it' : 'take back your upvote', res.error)
}

export async function createReply(postId: string, body: string) {
    fail('send your reply', (await supabase.from('forum_replies').insert({ post_id: postId, body: body.trim() })).error)
}

export async function setReplyDeleted(id: string, deleted: boolean) {
    fail(deleted ? 'delete it' : 'bring it back', (await supabase.from('forum_replies').update({ deleted_at: deleted ? new Date().toISOString() : null }).eq('id', id)).error)
}

export async function moderatePost(id: string, status: PostStatus, hidden: boolean) {
    fail('change it', (await supabase.rpc('moderate_post', { p_id: id, p_status: status, p_hidden: hidden })).error)
}

export async function moderateReply(id: string, hidden: boolean) {
    fail('change it', (await supabase.rpc('moderate_reply', { p_id: id, p_hidden: hidden })).error)
}
