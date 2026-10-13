import { Text, StyleSheet } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { tabScreenLayout } from '../TabScreenLayout'

const Tab = createBottomTabNavigator()
const hidden = (text: string) => {
    let node: any = screen.getByText(text, { includeHiddenElements: true })
    for (; node; node = node.parent) if (StyleSheet.flatten(node.props?.style)?.display === 'none') return true
    return false
}

it('hides the tab you left, so it never shows through a see-through page', async () => {
    await render(
        <NavigationContainer>
            <Tab.Navigator screenLayout={tabScreenLayout}>
                <Tab.Screen name="One" component={() => <Text>first page</Text>} />
                <Tab.Screen name="Two" component={() => <Text>second page</Text>} />
            </Tab.Navigator>
        </NavigationContainer>,
    )
    expect(hidden('first page')).toBe(false)
    await fireEvent.press(screen.getByRole('button', { name: /Two/ }))
    expect(hidden('second page')).toBe(false)
    expect(hidden('first page')).toBe(true)
})
