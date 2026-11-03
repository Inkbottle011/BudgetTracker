import { render, screen, fireEvent, within, act } from '@testing-library/react-native'
import ForumScreen from '../screens/ForumScreen'
import { memberName, buildThreads } from '../logic/forum'
import { ToastContext } from '../../../shared/ui/ToastContext'
import { fake, supabase } from '../../../../test/fakeSupabase'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)
const mockNavigate = jest.fn(), mockBack = jest.fn()
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate, goBack: mockBack, canGoBack: () => true }) }))

const ME = 'user-1'   // the fake signed-in user
const OTHER = '9b2c0d1e-0000-4000-8000-00000000a4f3'
const MOD = '7e1f0000-0000-4000-8000-0000000000dd'
const showToast = jest.fn()
const ops = (table: string, method: string) => fake.calls(table).flatMap(c => c.ops.filter(o => o.method === method).map(o => ({ args: o.args, call: c })))

let posts: any[], replies: any[], votes: any[]
beforeEach(() => {
    fake.reset()
    showToast.mockClear()
    posts = [
        { id: 'p1', user_id: OTHER, kind: 'idea', title: 'Budget templates', body: 'Like 50/30/20', status: 'planned', hidden: false, by_moderator: false, deleted_at: null, created_at: '2026-10-20T12:00:00Z' },
        { id: 'p2', user_id: ME, kind: 'problem', title: 'Chart is blank on my phone', body: '', status: 'open', hidden: false, by_moderator: false, deleted_at: null, created_at: '2026-11-01T12:00:00Z' },
    ]
    replies = [{ id: 'r1', post_id: 'p1', user_id: MOD, body: 'On the list for next month', hidden: false, by_moderator: true, deleted_at: null, created_at: '2026-10-21T12:00:00Z' }]
    votes = [{ post_id: 'p1', user_id: OTHER }, { post_id: 'p1', user_id: MOD }]
    const table = (rows: () => any[]) => (call: any) => call.ops.some((o: any) => ['insert', 'update', 'delete'].includes(o.method)) ? { data: null, error: null } : { data: rows(), error: null }
    fake.table('forum_posts', table(() => posts))
    fake.table('forum_replies', table(() => replies))
    fake.table('forum_votes', table(() => votes))
    ;(supabase.rpc as jest.Mock).mockImplementation(async (name: string) => ({ data: name === 'is_forum_moderator' ? false : null, error: null }))
})

async function renderForum() {
    await render(<ToastContext.Provider value={{ showToast }}><ForumScreen /></ToastContext.Provider>)
    await screen.findByText('Budget templates')
}
const card = (title: string) => within(screen.getByLabelText(`Post: ${title}`))

describe('anonymous names', () => {
    it('are "You" for you and "Member" plus four letters for everyone else, the same on every post', () => {
        expect(memberName(ME, ME)).toBe('You')
        expect(memberName(OTHER, ME)).toBe('Member A4F3')
        expect(memberName(OTHER, ME)).toBe(memberName(OTHER, 'someone-else'))
    })
})

describe('the forum', () => {
    it('lists the most upvoted first, with anonymous names, status and replies', async () => {
        await renderForum()
        const titles = () => screen.getAllByText(/^(Budget templates|Chart is blank on my phone)$/).map(t => t.props.children)
        expect(titles()).toEqual(['Budget templates', 'Chart is blank on my phone'])
        expect(card('Budget templates').getByText(/Member A4F3/)).toBeTruthy()
        expect(card('Budget templates').getByText('Planned')).toBeTruthy()
        expect(card('Budget templates').getByRole('button', { name: 'Upvote "Budget templates", 2 upvotes' })).toBeTruthy()
        expect(card('Chart is blank on my phone').getByText(/You/)).toBeTruthy()
        await fireEvent.press(screen.getByRole('button', { name: 'New' }))
        expect(titles()).toEqual(['Chart is blank on my phone', 'Budget templates'])
        await fireEvent.press(screen.getByRole('button', { name: 'Problems' }))
        expect(screen.queryByText('Budget templates')).toBeNull()
    })

    it('posts a new idea or problem', async () => {
        await renderForum()
        await fireEvent.press(screen.getByRole('button', { name: 'New post' }))
        await fireEvent.press(screen.getByRole('button', { name: 'An idea' }))
        await fireEvent.changeText(screen.getByLabelText('Title'), '  A calendar view  ')
        await fireEvent.changeText(screen.getByLabelText('Details (optional)'), 'See bills by day')
        posts = [...posts, { id: 'p3', user_id: ME, kind: 'idea', title: 'A calendar view', body: 'See bills by day', status: 'open', hidden: false, by_moderator: false, deleted_at: null, created_at: '2026-11-03T12:00:00Z' }]
        await fireEvent.press(screen.getByRole('button', { name: 'Post' }))
        expect(ops('forum_posts', 'insert')[0].args[0]).toEqual({ kind: 'idea', title: 'A calendar view', body: 'See bills by day' })
        expect(showToast).toHaveBeenCalledWith('Posted. Thanks for the idea!')
        expect(await screen.findByText('A calendar view')).toBeTruthy()
    })

    it('upvotes, and takes the upvote back', async () => {
        await renderForum()
        await fireEvent.press(card('Chart is blank on my phone').getByRole('button', { name: 'Upvote "Chart is blank on my phone", 0 upvotes' }))
        expect(ops('forum_votes', 'insert')[0].args[0]).toEqual({ post_id: 'p2' })
        const voted = card('Chart is blank on my phone').getByRole('button', { name: 'Remove your upvote from "Chart is blank on my phone", 1 upvote' })
        expect(voted.props.accessibilityState.selected).toBe(true)
        await fireEvent.press(voted)
        const del = ops('forum_votes', 'delete')[0].call.ops
        expect(del).toContainEqual({ method: 'eq', args: ['post_id', 'p2'] })
        expect(del).toContainEqual({ method: 'eq', args: ['user_id', ME] })
    })

    it('shows replies, marks the developer\'s, and replies', async () => {
        await renderForum()
        await fireEvent.press(card('Budget templates').getByRole('button', { name: 'Show 1 reply to "Budget templates"' }))
        expect(card('Budget templates').getByText('On the list for next month')).toBeTruthy()
        expect(card('Budget templates').getByText('Developer')).toBeTruthy()
        await fireEvent.changeText(card('Budget templates').getByLabelText('Reply to "Budget templates"'), 'Yes please!')
        await fireEvent.press(card('Budget templates').getByRole('button', { name: 'Send reply' }))
        expect(ops('forum_replies', 'insert')[0].args[0]).toEqual({ post_id: 'p1', body: 'Yes please!' })
    })

    it('deletes your own post after asking, with Undo, and edits it', async () => {
        await renderForum()
        expect(card('Budget templates').queryByRole('button', { name: 'Delete' })).toBeNull()   // not yours
        await fireEvent.press(card('Chart is blank on my phone').getByRole('button', { name: 'Edit' }))
        await fireEvent.changeText(screen.getByLabelText('Edit title'), 'Chart is blank on iPhone')
        await fireEvent.press(screen.getByRole('button', { name: 'Save' }))
        expect(ops('forum_posts', 'update')[0].args[0]).toEqual({ kind: 'problem', title: 'Chart is blank on iPhone', body: '' })

        await fireEvent.press(screen.getByRole('button', { name: 'Delete "Chart is blank on iPhone"' }))
        expect(screen.getByText('Delete your post?')).toBeTruthy()
        await fireEvent.press(screen.getByRole('button', { name: 'Delete' }))
        const update = ops('forum_posts', 'update').at(-1)!
        expect(update.args[0].deleted_at).toEqual(expect.any(String))
        const [message, , action] = showToast.mock.calls.at(-1)!
        expect(message).toBe('Post deleted')
        await act(async () => { await action.onPress() })
        expect(ops('forum_posts', 'update').at(-1)!.args[0]).toEqual({ deleted_at: null })
    })

    it('moderators set a status and hide posts or replies; others can\'t', async () => {
        await renderForum()
        expect(screen.queryByRole('button', { name: 'Mark "Budget templates" Done' })).toBeNull()
        ;(supabase.rpc as jest.Mock).mockImplementation(async (name: string) => ({ data: name === 'is_forum_moderator' ? true : null, error: null }))
        await act(async () => { screen.unmount() })
        await renderForum()
        await fireEvent.press(await screen.findByRole('button', { name: 'Mark "Budget templates" Done' }))
        expect(supabase.rpc).toHaveBeenCalledWith('moderate_post', { p_id: 'p1', p_status: 'done', p_hidden: false })
        await fireEvent.press(screen.getByRole('button', { name: 'Hide "Budget templates"' }))
        expect(supabase.rpc).toHaveBeenCalledWith('moderate_post', { p_id: 'p1', p_status: 'done', p_hidden: true })   // keeps the status just set
        await fireEvent.press(card('Budget templates').getByRole('button', { name: 'Show 1 reply to "Budget templates"' }))
        await fireEvent.press(card('Budget templates').getByRole('button', { name: 'Hide reply' }))
        expect(supabase.rpc).toHaveBeenCalledWith('moderate_reply', { p_id: 'r1', p_hidden: true })
    })

    it('says when there is nothing yet', async () => {
        posts = []; replies = []; votes = []
        await render(<ToastContext.Provider value={{ showToast }}><ForumScreen /></ToastContext.Provider>)
        expect(await screen.findByText('No posts yet')).toBeTruthy()
    })
})

describe('buildThreads', () => {
    it('counts upvotes and replies and sorts by top or new', () => {
        const t = buildThreads(posts, replies, votes, ME, 'top', 'all')
        expect(t.map(p => [p.id, p.votes, p.votedByMe, p.replies.length])).toEqual([['p1', 2, false, 1], ['p2', 0, false, 0]])
        expect(buildThreads(posts, replies, votes, ME, 'new', 'all').map(p => p.id)).toEqual(['p2', 'p1'])
    })
})
