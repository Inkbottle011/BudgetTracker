/** Which way money went, for showing a transaction: in (+), out (-), or moved between your own accounts. */
export function activityDirection(type: string): 'in' | 'out' | 'move' {
    if (type === 'transfer') return 'move'
    return type === 'income' || type === 'reimbursement' || type === 'withdrawal' ? 'in' : 'out'
}
