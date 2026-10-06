import { qrImageUri } from '../twoFactor'

describe('qrImageUri', () => {
    // What Supabase actually returns: raw SVG after the comma, with "#" colors that browsers
    // treat as the start of a URL fragment, cutting the image off
    const raw = 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#000000" d="M0 0h1v1H0z"/></svg>'

    it('encodes the SVG so browsers show the whole image', () => {
        const uri = qrImageUri(raw)
        expect(uri.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true)
        expect(uri).not.toContain('#')
        expect(decodeURIComponent(uri.slice(uri.indexOf(',') + 1))).toBe(raw.slice(raw.indexOf(',') + 1))
    })

    it('leaves images that are already encoded alone', () => {
        expect(qrImageUri('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=')
        const encoded = qrImageUri(raw)
        expect(qrImageUri(encoded)).toBe(encoded)
    })

    it('wraps a bare SVG too', () => {
        expect(qrImageUri('<svg fill="#fff"/>')).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg fill="#fff"/>')}`)
    })
})
