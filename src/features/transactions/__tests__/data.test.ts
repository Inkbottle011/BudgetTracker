import { loadAllTransactions } from '../logic/data'
import { fake, pagedTable } from '../../../../test/fakeSupabase'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)

beforeEach(() => fake.reset())

it('loads all your transactions, even more than 1,000, newest first in a stable order', async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({ id: `t${i}`, date: '2026-10-01' }))
    fake.table('transactions', pagedTable(rows))
    expect(await loadAllTransactions()).toHaveLength(1500)
    const order = fake.calls('transactions')[0].ops.filter(o => o.method === 'order').map(o => o.args[0])
    expect(order).toEqual(['date', 'id'])
})

it('gives nothing (rather than failing) if the database can\'t be reached', async () => {
    fake.table('transactions', { data: null, error: { message: 'offline' } })
    expect(await loadAllTransactions()).toBeNull()
})
