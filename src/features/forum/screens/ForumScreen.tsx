// The suggestions forum: everyone's ideas and problems, upvotes and replies. People appear anonymously.
import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTheme, useStyles, Palette } from '../../../shared/theme/theme'
import { Page, PageTitle, Button, Field, Segmented, EmptyState } from '../../../shared/ui/ui'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import { useToastContext } from '../../../shared/ui/ToastContext'
import {
    Post, Reply, Vote, Thread, PostKind, PostStatus, Sort, KindFilter, MAX_TITLE, MAX_BODY, KIND_LABELS, STATUS_LABELS,
    memberName, buildThreads, myUserId, loadForum, createPost, editPost, setPostDeleted, setVote, createReply,
    setReplyDeleted, moderatePost, moderateReply,
} from '../logic/forum'

const NEW_KINDS: { value: PostKind; label: string }[] = [{ value: 'idea', label: 'An idea' }, { value: 'problem', label: 'A problem' }, { value: 'other', label: 'Other' }]
const THANKS: Record<PostKind, string> = { idea: 'Posted. Thanks for the idea!', problem: 'Posted. Thanks for letting us know!', other: 'Posted. Thanks!' }
const STATUSES: PostStatus[] = ['open', 'planned', 'done', 'wont_do']
const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export default function ForumScreen() {
    const navigation = useNavigation<any>()
    const { showToast } = useToastContext()
    const s = useStyles(makeStyles)
    const [me, setMe] = useState<string | null>(null)
    const [posts, setPosts] = useState<Post[]>([])
    const [replies, setReplies] = useState<Reply[]>([])
    const [votes, setVotes] = useState<Vote[]>([])
    const [moderator, setModerator] = useState(false)
    const [loading, setLoading] = useState(true)
    const [sort, setSort] = useState<Sort>('top')
    const [kind, setKind] = useState<KindFilter>('all')
    const [writing, setWriting] = useState(false)
    const [deleting, setDeleting] = useState<Post | null>(null)

    async function reload() {
        try {
            const [id, data] = await Promise.all([myUserId(), loadForum()])
            setMe(id); setPosts(data.posts); setReplies(data.replies); setVotes(data.votes); setModerator(data.moderator)
        } catch (e: any) {
            showToast(e?.message ?? "Couldn't load the forum", 'error')
        }
        setLoading(false)
    }
    useEffect(() => { reload() }, [])

    const act = async (work: () => Promise<void>, after?: () => void) => {
        try { await work(); after?.() } catch (e: any) { showToast(e?.message ?? 'Something went wrong', 'error') }
    }
    const patchPost = (id: string, patch: Partial<Post>) => setPosts(list => list.map(p => (p.id === id ? { ...p, ...patch } : p)))
    const patchReply = (id: string, patch: Partial<Reply>) => setReplies(list => list.map(r => (r.id === id ? { ...r, ...patch } : r)))

    const threads = buildThreads(posts, replies, votes, me, sort, kind)

    async function remove(post: Post) {
        setDeleting(null)
        await act(() => setPostDeleted(post.id, true), () => {
            patchPost(post.id, { deleted_at: new Date().toISOString() })
            showToast('Post deleted', 'success', {
                label: 'Undo',
                onPress: () => act(() => setPostDeleted(post.id, false), () => { patchPost(post.id, { deleted_at: null }); showToast('Your post is back') }),
            })
        })
    }

    return (
        <Page maxWidth={820}>
            <PageTitle
                title="Suggestions forum"
                subtitle="Ideas and problems from everyone using the app. Upvote what you want most. Everyone appears anonymously."
                actions={
                    <View style={s.actions}>
                        {navigation?.canGoBack?.() && <Button variant="secondary" label="Back" onPress={() => navigation.goBack()} />}
                        <Button label={writing ? 'Close' : 'New post'} accessibilityLabel={writing ? 'Close new post' : 'New post'} onPress={() => setWriting(!writing)} />
                    </View>
                }
            />

            {writing && (
                <NewPost onPosted={async (k) => { setWriting(false); showToast(THANKS[k]); await reload() }} onError={m => showToast(m, 'error')} />
            )}

            <View style={s.controls}>
                <Segmented<Sort> value={sort} onChange={setSort} options={[{ value: 'top', label: 'Top' }, { value: 'new', label: 'New' }]} />
                <Segmented<KindFilter> value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'idea', label: 'Ideas' }, { value: 'problem', label: 'Problems' }]} />
            </View>

            {!loading && threads.length === 0 && (
                <EmptyState title="No posts yet" body={kind === 'all' ? 'Be the first to suggest something.' : 'Nothing here yet. Try All.'} />
            )}

            {threads.map(t => (
                <PostCard
                    key={t.id} thread={t} me={me} moderator={moderator}
                    onVote={() => act(() => setVote(t.id, me!, !t.votedByMe), () => setVotes(v => t.votedByMe
                        ? v.filter(x => !(x.post_id === t.id && x.user_id === me)) : [...v, { post_id: t.id, user_id: me! }]))}
                    onEdit={(k, title, body) => act(() => editPost(t.id, k, title, body), () => patchPost(t.id, { kind: k, title: title.trim(), body: body.trim() }))}
                    onDelete={() => setDeleting(t)}
                    onReply={body => act(() => createReply(t.id, body), reload)}
                    onDeleteReply={r => act(() => setReplyDeleted(r.id, true), () => {
                        patchReply(r.id, { deleted_at: new Date().toISOString() })
                        showToast('Reply deleted', 'success', { label: 'Undo', onPress: () => act(() => setReplyDeleted(r.id, false), () => patchReply(r.id, { deleted_at: null })) })
                    })}
                    onModerate={(status, hidden) => act(() => moderatePost(t.id, status, hidden), () => patchPost(t.id, { status, hidden }))}
                    onModerateReply={(r, hidden) => act(() => moderateReply(r.id, hidden), () => patchReply(r.id, { hidden }))}
                />
            ))}

            <ConfirmDialog
                visible={!!deleting}
                title="Delete your post?"
                message="It disappears for everyone, along with its upvotes and replies. You can undo it straight after."
                confirmLabel="Delete"
                onCancel={() => setDeleting(null)}
                onConfirm={() => remove(deleting!)}
            />
        </Page>
    )
}

function NewPost({ onPosted, onError }: { onPosted: (k: PostKind) => void; onError: (m: string) => void }) {
    const { c: C } = useTheme()
    const s = useStyles(makeStyles)
    const [kind, setKind] = useState<PostKind>('idea')
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [busy, setBusy] = useState(false)
    async function post() {
        setBusy(true)
        try { await createPost(kind, title, body); onPosted(kind) } catch (e: any) { onError(e?.message ?? "Couldn't post that"); setBusy(false) }
    }
    return (
        <View style={s.card}>
            <Segmented<PostKind> value={kind} onChange={setKind} options={NEW_KINDS} style={{ marginBottom: 12 }} />
            <Field label="Title" value={title} onChangeText={setTitle} maxLength={MAX_TITLE}
                placeholder={kind === 'problem' ? 'What went wrong, in a few words' : 'Your idea, in a few words'} />
            <Text style={s.label}>Details (optional)</Text>
            <TextInput accessibilityLabel="Details (optional)" value={body} onChangeText={setBody} multiline maxLength={MAX_BODY}
                placeholder={kind === 'problem' ? 'Where did it happen? What did you expect?' : 'Why would it help?'}
                placeholderTextColor={C.faint} style={s.textarea} textAlignVertical="top" />
            <View style={s.formButtons}>
                <Button label="Post" onPress={post} loading={busy} disabled={!title.trim()} />
            </View>
        </View>
    )
}

function PostCard({ thread: t, me, moderator, onVote, onEdit, onDelete, onReply, onDeleteReply, onModerate, onModerateReply }: {
    thread: Thread; me: string | null; moderator: boolean
    onVote: () => void
    onEdit: (kind: PostKind, title: string, body: string) => void
    onDelete: () => void
    onReply: (body: string) => Promise<void> | void
    onDeleteReply: (r: Reply) => void
    onModerate: (status: PostStatus, hidden: boolean) => void
    onModerateReply: (r: Reply, hidden: boolean) => void
}) {
    const { c: C } = useTheme()
    const s = useStyles(makeStyles)
    const [open, setOpen] = useState(false)
    const [editing, setEditing] = useState(false)
    const [title, setTitle] = useState(t.title)
    const [body, setBody] = useState(t.body)
    const [reply, setReply] = useState('')
    const mine = !!me && t.user_id === me
    const n = t.replies.length
    const statusColor = { open: C.muted, planned: C.primary, done: C.good, wont_do: C.muted }[t.status]

    return (
        <View style={[s.card, t.hidden && s.hiddenCard]} accessibilityLabel={`Post: ${t.title}`}>
            <View style={s.top}>
                <TouchableOpacity
                    accessibilityRole="button" accessibilityState={{ selected: t.votedByMe }}
                    accessibilityLabel={t.votedByMe
                        ? `Remove your upvote from "${t.title}", ${plural(t.votes, 'upvote', 'upvotes')}`
                        : `Upvote "${t.title}", ${plural(t.votes, 'upvote', 'upvotes')}`}
                    onPress={onVote} disabled={!me} style={[s.vote, t.votedByMe && { backgroundColor: C.primary, borderColor: C.primary }]}
                >
                    <Text style={[s.voteArrow, t.votedByMe && { color: C.onPrimary }]}>▲</Text>
                    <Text style={[s.voteCount, t.votedByMe && { color: C.onPrimary }]}>{t.votes}</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, minWidth: 0 }}>
                    {editing ? (
                        <>
                            <Field label="Edit title" value={title} onChangeText={setTitle} maxLength={MAX_TITLE} />
                            <TextInput accessibilityLabel="Edit details" value={body} onChangeText={setBody} multiline maxLength={MAX_BODY} style={s.textarea} textAlignVertical="top" />
                            <View style={s.formButtons}>
                                <Button small variant="ghost" label="Cancel" onPress={() => { setEditing(false); setTitle(t.title); setBody(t.body) }} />
                                <Button small label="Save" disabled={!title.trim()} onPress={() => { setEditing(false); onEdit(t.kind, title, body) }} />
                            </View>
                        </>
                    ) : (
                        <>
                            <Text style={s.title}>{t.title}</Text>
                            <View style={s.meta}>
                                <Text style={s.metaText}>{memberName(t.user_id, me)} · {when(t.created_at)} · {KIND_LABELS[t.kind]}</Text>
                                {t.by_moderator && <Text style={s.dev}>Developer</Text>}
                                {t.status !== 'open' && <Text style={[s.status, { color: statusColor, borderColor: statusColor }]}>{STATUS_LABELS[t.status]}</Text>}
                            </View>
                            {t.hidden && <Text style={s.hiddenNote}>Hidden by a moderator: only you{moderator && !mine ? ', the author' : ''} and moderators can see it.</Text>}
                            {!!t.body && <Text style={s.body}>{t.body}</Text>}
                        </>
                    )}
                </View>
            </View>

            {!editing && (
                <View style={s.footer}>
                    <Button small variant="ghost"
                        label={open ? 'Hide replies' : n ? plural(n, 'reply', 'replies') : 'Reply'}
                        accessibilityLabel={open ? `Hide replies to "${t.title}"` : n ? `Show ${plural(n, 'reply', 'replies')} to "${t.title}"` : `Write a reply to "${t.title}"`}
                        onPress={() => setOpen(!open)} />
                    {mine && <Button small variant="ghost" label="Edit" onPress={() => setEditing(true)} />}
                    {mine && <Button small variant="ghost" label="Delete" accessibilityLabel={`Delete "${t.title}"`} onPress={onDelete} />}
                </View>
            )}

            {moderator && !editing && (
                <View style={s.mod}>
                    <Text style={s.modLabel}>Moderator</Text>
                    {STATUSES.map(st => (
                        <TouchableOpacity key={st} accessibilityRole="button" accessibilityLabel={`Mark "${t.title}" ${STATUS_LABELS[st]}`}
                            accessibilityState={{ selected: t.status === st }} onPress={() => onModerate(st, t.hidden)}
                            style={[s.modChip, t.status === st && { backgroundColor: C.primarySoft, borderColor: C.primary }]}>
                            <Text style={s.modChipText}>{STATUS_LABELS[st]}</Text>
                        </TouchableOpacity>
                    ))}
                    <Button small variant="ghost" label={t.hidden ? 'Unhide' : 'Hide'} accessibilityLabel={t.hidden ? `Show "${t.title}" again` : `Hide "${t.title}"`}
                        onPress={() => onModerate(t.status, !t.hidden)} />
                </View>
            )}

            {open && (
                <View style={s.replies}>
                    {t.replies.map(r => (
                        <View key={r.id} style={[s.reply, r.hidden && s.hiddenCard]}>
                            <View style={s.meta}>
                                <Text style={s.metaText}>{memberName(r.user_id, me)} · {when(r.created_at)}</Text>
                                {r.by_moderator && <Text style={s.dev}>Developer</Text>}
                                {r.hidden && <Text style={s.metaText}>· hidden</Text>}
                            </View>
                            <Text style={s.body}>{r.body}</Text>
                            <View style={s.footer}>
                                {me === r.user_id && <Button small variant="ghost" label="Delete" accessibilityLabel="Delete reply" onPress={() => onDeleteReply(r)} />}
                                {moderator && <Button small variant="ghost" label={r.hidden ? 'Unhide' : 'Hide'} accessibilityLabel={r.hidden ? 'Show reply again' : 'Hide reply'} onPress={() => onModerateReply(r, !r.hidden)} />}
                            </View>
                        </View>
                    ))}
                    {me && (
                        <View style={s.replyBox}>
                            <TextInput accessibilityLabel={`Reply to "${t.title}"`} value={reply} onChangeText={setReply} multiline maxLength={MAX_BODY}
                                placeholder="Write a reply" placeholderTextColor={C.faint} style={[s.textarea, { minHeight: 60 }]} textAlignVertical="top" />
                            <View style={s.formButtons}>
                                <Button small label="Send" accessibilityLabel="Send reply" disabled={!reply.trim()} onPress={async () => { const text = reply; setReply(''); await onReply(text) }} />
                            </View>
                        </View>
                    )}
                </View>
            )}
        </View>
    )
}

const makeStyles = (C: Palette) => StyleSheet.create({
    actions: { flexDirection: 'row', gap: 8 },
    controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
    card: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 12 },
    hiddenCard: { opacity: 0.6, borderStyle: 'dashed' },
    top: { flexDirection: 'row', gap: 14 },
    vote: { width: 48, alignItems: 'center', paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.surfaceAlt, alignSelf: 'flex-start' },
    voteArrow: { fontSize: 12, color: C.muted },
    voteCount: { fontSize: 16, fontWeight: '800', color: C.ink },
    title: { fontSize: 16, fontWeight: '700', color: C.ink },
    meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 },
    metaText: { fontSize: 12, color: C.muted },
    dev: { fontSize: 11, fontWeight: '800', color: C.onPrimary, backgroundColor: C.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
    status: { fontSize: 11, fontWeight: '800', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
    hiddenNote: { fontSize: 12, color: C.warn, marginTop: 4 },
    body: { fontSize: 14, color: C.text, lineHeight: 20, marginTop: 8 },
    footer: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
    mod: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: C.line },
    modLabel: { fontSize: 12, fontWeight: '700', color: C.muted, marginRight: 2 },
    modChip: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    modChipText: { fontSize: 12, color: C.text, fontWeight: '600' },
    replies: { marginTop: 10, paddingLeft: 14, borderLeftWidth: 2, borderColor: C.line, gap: 4 },
    reply: { paddingVertical: 6 },
    replyBox: { marginTop: 6 },
    label: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 },
    textarea: { minHeight: 90, backgroundColor: C.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: C.line, padding: 12, fontSize: 15, color: C.ink },
    formButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
})
