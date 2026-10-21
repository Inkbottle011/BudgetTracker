// Supabase returns at most 1,000 rows per request. This reads every row a query matches, a page at a time.
// Give the query a stable order (for example by date, then id) so pages don't overlap or skip rows.
const PAGE = 1000

export async function fetchAllRows<T>(makeQuery: () => any): Promise<T[]> {
    const out: T[] = []
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await makeQuery().range(from, from + PAGE - 1)
        if (error) throw error
        out.push(...(data ?? []))
        if (!data || data.length < PAGE) return out
    }
}
