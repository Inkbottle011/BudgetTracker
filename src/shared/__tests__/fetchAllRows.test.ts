import { fetchAllRows } from '../fetchAllRows'
import { fake, supabase, pagedTable } from '../../../test/fakeSupabase'

jest.mock('../supabase', () => require('../../../test/fakeSupabase').module)

beforeEach(() => fake.reset())

it('reads every row, a page at a time, past the 1,000-row limit', async () => {
    const rows = Array.from({ length: 2345 }, (_, i) => ({ id: i }))
    fake.table('transactions', pagedTable(rows))
    const all = await fetchAllRows(() => supabase.from('transactions').select('*'))
    expect(all).toHaveLength(2345)
    expect(fake.calls('transactions')).toHaveLength(3)
})

it('passes on errors', async () => {
    fake.table('transactions', { data: null, error: { message: 'boom' } })
    await expect(fetchAllRows(() => supabase.from('transactions').select('*'))).rejects.toMatchObject({ message: 'boom' })
})
