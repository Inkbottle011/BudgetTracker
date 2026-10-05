// Runs before every test file.
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'

jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

// expo-linking reads the app config, which isn't available in tests
jest.mock('expo-linking', () => ({
    createURL: jest.fn((path: string) => `budgettracker://${path.replace(/^\//, '')}`),
    parse: jest.fn((url: string) => {
        const u = new URL(url)
        return { queryParams: Object.fromEntries(u.searchParams.entries()) }
    }),
    getInitialURL: jest.fn(async () => null),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}))

// Icon fonts aren't loaded in tests; draw icons as their name instead
jest.mock('@expo/vector-icons', () => {
    const { Text } = require('react-native')
    const Icon = ({ name }: { name: string }) => require('react').createElement(Text, null, `[${name}]`)
    return { Ionicons: Icon }
})
