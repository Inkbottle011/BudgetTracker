import { useEffect, useMemo, useState } from 'react'
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, TouchableOpacity, Pressable, ActivityIndicator, StyleSheet, Modal, Platform } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as Linking from 'expo-linking'
import { supabase } from './shared/supabase'
import { DashboardScreen as Dashboard } from './features/dashboard'
import { AuthScreen, BrandMark, ResetPasswordScreen, TwoFactorPrompt, needsTwoFactorCode } from './features/account'
import { TransactionsScreen } from './features/transactions'
import { BudgetScreen } from './features/budget'
import { SettingsScreen } from './features/settings'
import { SubscriptionsScreen, syncSubscriptionCharges } from './features/subscriptions'
import { SpaceBackground } from './features/appearance'
import { ErrorBoundary } from './shared/ui/ErrorBoundary'
import { Ionicons } from '@expo/vector-icons'
import { Toast } from './shared/ui/Toast'
import { ToastContext } from './shared/ui/ToastContext'
import { useToast } from './shared/ui/useToast'
import { useToastContext } from './shared/ui/ToastContext'
import { ThemeProvider, useTheme, useStyles, Palette } from './shared/theme/theme'
import { Button } from './shared/ui/ui'
import { tabScreenLayout } from './shared/ui/TabScreenLayout'

const Tab = createBottomTabNavigator()

/** The bar across the top: the app name, and your initial, which opens the account menu. */
export function AppHeader({ userEmail }: { userEmail: string }) {
  const styles = useStyles(makeStyles)
  const [showProfile, setShowProfile] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const { showToast } = useToastContext()
  const initial = (userEmail || '?').charAt(0).toUpperCase()

  async function handleSignOut() {
    setSigningOut(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) showToast(`Couldn't sign out: ${error.message}. Check your connection and try again.`, 'error')
      else { setShowProfile(false); showToast('Signed out') }
    } catch (e: any) {
      showToast(`Couldn't sign out: ${e?.message ?? 'unknown error'}. Check your connection and try again.`, 'error')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <BrandMark size={26} />
        <Text style={styles.title}>Budget Tracker</Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Account menu"
        onPress={() => setShowProfile(true)}
        style={styles.avatar}
        hitSlop={8}
      >
        <Text style={styles.avatarText}>{initial}</Text>
      </TouchableOpacity>

      <Modal visible={showProfile} transparent animationType="fade" onRequestClose={() => setShowProfile(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowProfile(false)} accessibilityLabel="Close account menu">
          <Pressable style={styles.menu} onPress={() => {}}>
            <View style={styles.menuTop}>
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLargeText}>{initial}</Text>
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.menuLabel}>Signed in as</Text>
                <Text style={styles.menuEmail} numberOfLines={1}>{userEmail}</Text>
              </View>
            </View>
            <Button variant="danger" label="Sign out" onPress={handleSignOut} loading={signingOut} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const makeStyles = (C: Palette) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, minHeight: 56,
    backgroundColor: C.bar, borderBottomWidth: 1, borderColor: C.barLine,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 17, fontWeight: '700', color: C.onBar },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.onBar, fontWeight: '700', fontSize: 15 },
  avatarLarge: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarLargeText: { color: C.primary, fontWeight: '700', fontSize: 18 },
  overlay: { flex: 1, backgroundColor: C.scrim, alignItems: 'flex-end' },
  menu: {
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.line,
    padding: 16, marginTop: 60, marginHorizontal: 16, width: 280, maxWidth: '92%', gap: 16,
    shadowColor: C.shadow, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  menuTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuLabel: { fontSize: 12, color: C.muted },
  menuEmail: { fontSize: 14, color: C.ink, fontWeight: '600', marginTop: 2 },
})

const TAB_ICONS: Record<string, [string, string]> = {
  Dashboard: ['home', 'home-outline'],
  Transactions: ['list', 'list-outline'],
  Subscriptions: ['repeat', 'repeat-outline'],
  Budget: ['bar-chart', 'bar-chart-outline'],
  Settings: ['settings', 'settings-outline'],
}

/** The tabs and screens, colored from the theme. */
function MainApp({ userEmail }: { userEmail: string }) {
  const { c, scheme, backdrop } = useTheme()
  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme
    return {
      ...base,
      dark: scheme === 'dark',
      colors: { ...base.colors, background: backdrop, card: c.surface, text: c.ink, border: c.line, primary: c.primary, notification: c.bad },
    }
  }, [c, scheme, backdrop])

  return (
    <View style={{ flex: 1, backgroundColor: backdrop }}>
      <AppHeader userEmail={userEmail} />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenLayout={tabScreenLayout}
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ focused, color, size }) => {
              const [on, off] = TAB_ICONS[route.name] ?? ['ellipse', 'ellipse-outline']
              return <Ionicons name={(focused ? on : off) as any} size={size} color={color} />
            },
            tabBarActiveTintColor: c.onBar,
            tabBarInactiveTintColor: c.onBarMuted,
            tabBarStyle: { backgroundColor: c.bar, borderTopColor: c.barLine, borderTopWidth: 1 },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            sceneStyle: { backgroundColor: backdrop },
          })}
        >
          <Tab.Screen name="Dashboard" component={Dashboard} />
          <Tab.Screen name="Transactions" component={TransactionsScreen} />
          <Tab.Screen name="Subscriptions" component={SubscriptionsScreen} />
          <Tab.Screen name="Budget" component={BudgetScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </View>
  )
}

/** A quiet spinner on the page background while the app gets ready. */
function Waiting() {
  const { c, backdrop } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: backdrop, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={c.primary} />
    </View>
  )
}

/** Light or dark status bar text to match the theme. */
function ThemedStatusBar() {
  // The top bar is a deep theme color in both light and dark, so the status bar text is always light
  return <StatusBar style="light" />
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedStatusBar />
      <View style={{ flex: 1 }}>
        <SpaceBackground />
        <AppContent />
      </View>
    </ThemeProvider>
  )
}

function AppContent() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isRecovering, setIsRecovering] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [chargesSynced, setChargesSynced] = useState(false)
  const [needsCode, setNeedsCode] = useState<boolean | null>(null)
  const { toast, showToast, hideToast } = useToast()
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Fired when the user opens the reset link from their email
      if (event === 'PASSWORD_RECOVERY') setIsRecovering(true)
      setSession(session)
    })
    
    // Links from Supabase emails (password reset, email confirmation) come back with ?code=...
    async function handleAuthLink(url: string | null) {
      if (!url) return
      const { queryParams } = Linking.parse(url)
      const code = typeof queryParams?.code === 'string' ? queryParams.code : null
      const errorDescription = typeof queryParams?.error_description === 'string' ? queryParams.error_description : null
      
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) setLinkError('That link is invalid or has expired. Please request a new one.')
      } else if (errorDescription) {
        setLinkError(errorDescription)
      } else {
        return
      }
      
      // Clear the code from the browser address bar so a refresh doesn't reuse it
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }
    
    Linking.getInitialURL().then(handleAuthLink)
    const linkSub = Linking.addEventListener('url', ({ url }) => handleAuthLink(url))
    
    return () => {
      subscription.unsubscribe()
      linkSub.remove()
    }
  }, [])
  
  // With two-factor sign-in on, ask for the code before showing anything
  const accessToken = session?.access_token
  useEffect(() => {
    if (!session) { setNeedsCode(null); return }
    needsTwoFactorCode().then(setNeedsCode).catch(() => setNeedsCode(false))
  }, [accessToken, !!session])
  
  // Once signed in, add any subscription charges that came due while the app was closed
  // (or while Supabase was paused) before the tabs load their data
  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) return
    let done = false
    const finish = () => { if (!done) { done = true; setChargesSynced(true) } }
    setChargesSynced(false)
    syncSubscriptionCharges().finally(finish)
    const timer = setTimeout(finish, 8000) // don't hold the app up if the database is slow
    return () => { done = true; clearTimeout(timer) }
  }, [userId])
  
  if (loading) return <Waiting />
  if (session && isRecovering) return <ResetPasswordScreen onDone={() => setIsRecovering(false)} />
  if (!session) return <AuthScreen key={linkError ?? "auth"} initialError={linkError} />
  if (needsCode === null) return <Waiting />
  if (needsCode) return <TwoFactorPrompt onDone={() => setNeedsCode(false)} />
  if (!chargesSynced) return <Waiting />
  
  return (
    <ErrorBoundary>
      <ToastContext.Provider value={{ showToast }}>
        <MainApp userEmail={session.user.email} />
        <Toast message={toast.message} type={toast.type} visible={toast.visible} onHide={hideToast} />
      </ToastContext.Provider>
    </ErrorBoundary>
  )
}
