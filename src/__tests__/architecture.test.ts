/** @jest-environment node */
// Keeps the app's structure honest. Each feature in src/features/<name> is a self-contained part of the
// app; these rules stop features from quietly tangling together again. If one fails, it says what to change.
import fs from 'fs'
import path from 'path'

const SRC = path.join(__dirname, '..')
const FEATURES = path.join(SRC, 'features')
const SHARED = path.join(SRC, 'shared')

/** Which feature owns each database table and server function; only it may use them directly. */
const OWNERS: Record<string, string> = {
    transactions: 'transactions', split_shares: 'transactions', merchant_renames: 'transactions', rename_transactions: 'transactions',
    budget_items: 'budget', budget_amounts: 'budget',
    subscriptions: 'subscriptions', generate_subscription_transactions: 'subscriptions', dismissed_subscription_suggestions: 'subscriptions',
    bank_connections: 'bank', bank_accounts: 'bank', bank_possible_duplicates: 'bank', bank_pending_transactions: 'bank', resolve_possible_duplicate: 'bank', bank: 'bank',
}

function files(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) return files(p)
        return /\.(ts|tsx)$/.test(e.name) ? [p] : []
    })
}
const isTest = (f: string) => f.split(path.sep).includes('__tests__')
const appFiles = files(SRC).filter(f => !isTest(f))
const rel = (f: string) => path.relative(SRC, f).split(path.sep).join('/')
const featureOf = (f: string) => {
    const r = path.relative(FEATURES, f)
    return r.startsWith('..') ? null : r.split(path.sep)[0]
}

function imports(file: string): string[] {
    const src = fs.readFileSync(file, 'utf8')
    const found: string[] = []
    for (const re of [/\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]/g, /\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]/g, /\brequire\(\s*['"](\.{1,2}\/[^'"]+)['"]/g]) {
        for (const m of src.matchAll(re)) found.push(path.resolve(path.dirname(file), m[1]))
    }
    return found
}

// Each feature has two front doors:
//   api.ts    its data and logic, no screens. What other features' logic uses.
//   index.ts  everything, screens too (re-exports api.ts). For the app shell and the Settings page.
const door = (target: string, feature: string) =>
    target === path.join(FEATURES, feature) || target === path.join(FEATURES, feature, 'index') ? 'index'
        : target === path.join(FEATURES, feature, 'api') ? 'api' : null
const isLogic = (f: string) => f.split(path.sep).includes('logic') || /[\\/]api\.ts$/.test(f)

it('features use each other only through their front doors', () => {
    const problems: string[] = []
    for (const f of appFiles) {
        const mine = featureOf(f)
        for (const target of imports(f)) {
            const theirs = featureOf(target)
            if (!theirs || theirs === mine) continue
            const via = door(target, theirs)
            if (!via) problems.push(`${rel(f)} reaches into ${rel(target)}: import from '…/features/${theirs}' (or its api) instead`)
            else if (via === 'index' && isLogic(f)) problems.push(`${rel(f)} is logic, so it should use '…/features/${theirs}/api' (no screens)`)
        }
    }
    expect(problems).toEqual([])
})

it('every feature has both front doors, and api.ts has no screens', () => {
    const problems: string[] = []
    for (const name of fs.readdirSync(FEATURES)) {
        for (const door of ['index.ts', 'api.ts']) if (!fs.existsSync(path.join(FEATURES, name, door))) problems.push(`${name} has no ${door}`)
        const api = path.join(FEATURES, name, 'api.ts')
        if (fs.existsSync(api)) for (const t of imports(api)) if (t.split(path.sep).includes('screens')) problems.push(`${name}/api.ts exports a screen: ${rel(t)}`)
    }
    expect(problems).toEqual([])
})

it('shared code never depends on a feature', () => {
    const problems = files(SHARED).filter(f => !isTest(f)).flatMap(f =>
        imports(f).filter(t => featureOf(t)).map(t => `${rel(f)} imports ${rel(t)}`))
    expect(problems).toEqual([])
})

it('only the feature that owns a table (or server function) uses it directly', () => {
    const problems: string[] = []
    for (const f of appFiles) {
        const src = fs.readFileSync(f, 'utf8')
        for (const m of src.matchAll(/\.(?:from|rpc)\(\s*['"]([a-z_]+)['"]|functions\.invoke\(\s*['"]([a-z_-]+)['"]/g)) {
            const name = m[1] ?? m[2]
            const owner = OWNERS[name]
            if (!owner) { problems.push(`${rel(f)} uses '${name}', which has no owner listed in this test`); continue }
            if (featureOf(f) !== owner) problems.push(`${rel(f)} uses '${name}' directly: ask the ${owner} feature instead`)
        }
    }
    expect(problems).toEqual([])
})
