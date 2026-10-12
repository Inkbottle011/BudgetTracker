import { render, screen, fireEvent } from '@testing-library/react-native'
import { Button, Field, Chip, Segmented, TypeBadge, Section, EmptyState } from '../ui'
import { formatMoney } from '../../lib/format'

describe('Button', () => {
    it('does its action, and nothing while disabled or busy', async () => {
        const onPress = jest.fn()
        const { rerender } = await render(<Button label="Save" onPress={onPress} />)
        await fireEvent.press(screen.getByText('Save'))
        expect(onPress).toHaveBeenCalledTimes(1)
        await rerender(<Button label="Save" onPress={onPress} disabled />)
        await fireEvent.press(screen.getByText('Save'))
        await rerender(<Button label="Save" onPress={onPress} loading />)
        expect(screen.queryByText('Save')).toBeNull()
        expect(onPress).toHaveBeenCalledTimes(1)
    })
})

describe('Field', () => {
    it('has a label, and shows a problem under it', async () => {
        await render(<Field label="Amount" placeholder="0.00" value="" onChangeText={() => {}} error="Enter an amount" />)
        expect(screen.getByText('Amount')).toBeTruthy()
        expect(screen.getByText('Enter an amount')).toBeTruthy()
        expect(screen.getByLabelText('Amount')).toBeTruthy()
    })
})

describe('Chip and Segmented', () => {
    it('chips say when they are selected', async () => {
        await render(<Chip label="Food" selected onPress={() => {}} />)
        expect(screen.getByRole('button', { name: 'Food' }).props.accessibilityState).toMatchObject({ selected: true })
    })
    it('segmented control switches', async () => {
        const onChange = jest.fn()
        await render(<Segmented value="light" onChange={onChange} options={[{ value: 'system', label: 'Device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />)
        await fireEvent.press(screen.getByText('Dark'))
        expect(onChange).toHaveBeenCalledWith('dark')
    })
})

describe('TypeBadge, Section, EmptyState', () => {
    it('render their words', async () => {
        await render(<>
            <TypeBadge type="reimbursement" />
            <Section title="Recent" action={<Button label="See all" variant="ghost" onPress={() => {}} />}><EmptyState title="Nothing yet" body="Add one" /></Section>
        </>)
        expect(screen.getByText('Reimbursement')).toBeTruthy()
        expect(screen.getByText('Recent')).toBeTruthy()
        expect(screen.getByText('See all')).toBeTruthy()
        expect(screen.getByText('Nothing yet')).toBeTruthy()
    })
})

describe('formatMoney', () => {
    it.each([
        [1234.5, {}, '$1,234.50'],
        [-270, {}, '-$270.00'],
        [270, { sign: true }, '+$270.00'],
        [0, { sign: true }, '$0.00'],
        [1234.5, { cents: false }, '$1,235'],
        [-270, { cents: false }, '-$270'],
    ])('%p %p -> %p', (n, opts, out) => expect(formatMoney(n as number, opts as any)).toBe(out))
})
