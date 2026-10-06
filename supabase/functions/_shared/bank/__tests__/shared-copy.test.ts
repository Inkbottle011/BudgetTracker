/** @jest-environment node */
import fs from 'fs'
import path from 'path'

// Server functions can't import app files, so they use a copy of lib/entry.ts.
// If this fails, run `npm run sync:shared` to copy the latest version over.
it('the server copy of lib/entry.ts is up to date', () => {
    const root = path.join(__dirname, '..', '..', '..', '..', '..')
    const app = fs.readFileSync(path.join(root, 'lib/entry.ts'), 'utf8')
    const server = fs.readFileSync(path.join(root, 'supabase/functions/_shared/entry.ts'), 'utf8')
    expect(server).toBe(app)
})
