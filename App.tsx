import { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, Platform } from 'react-native'
import * as Linking from 'expo-linking'
import { supabase } from './lib/supabase'
import Dashboard from './app/dashboard/index'
import AuthScreen from './app/auth'
import ResetPasswordScreen from './app/reset-password'
import TransactionsScreen from './app/transactions/index'
import BudgetScreen from './app/budget/index'
import SettingsScreen from './app/settings'
import SubscriptionsScreen from './app/subscriptions/index'
import { syncSubscriptionCharges } from './lib/subscriptions'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Ionicons } from '@expo/vector-icons'
import { Toast } from './components/Toast'
import { ToastContext } from './context/ToastContext'
import { useToast } from './hooks/useToast'
import { useToastContext } from './context/ToastContext'

const Tab = createBottomTabNavigator()

function Header({ userEmail }: { userEmail: string }) {
  const [showProfile, setShowProfile] = useState(false)
  const { showToast } = useToastContext()
  
  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()
    if (error) Alert.alert('Error', error.message)
      else showToast('Signed out successfully')
  }
  
  return (
    <View style={styles.header}>
    <Text style={styles.headerTitle}>💰 Budget Tracker</Text>
    <TouchableOpacity
    style={styles.profileBtn}
    onPress={() => setShowProfile(true)}
    >
    <View style={styles.avatar}>
    <Text style={styles.avatarText}>
    {userEmail.charAt(0).toUpperCase()}
    </Text>
    </View>
    </TouchableOpacity>
    
    <Modal
    visible={showProfile}
    transparent
    animationType="fade"
    onRequestClose={() => setShowProfile(false)}
    >
    <TouchableOpacity
    style={styles.modalOverlay}
    onPress={() => setShowProfile(false)}
    >
    <View style={styles.profileCard}>
    <View style={styles.profileHeader}>
    <View style={styles.avatarLarge}>
    <Text style={styles.avatarLargeText}>
    {userEmail.charAt(0).toUpperCase()}
    </Text>
    </View>
    <Text style={styles.profileEmail}>{userEmail}</Text>
    </View>
    <TouchableOpacity
    style={styles.signOutBtn}
    onPress={handleSignOut}
    >
    <Text style={styles.signOutText}>Sign Out</Text>
    </TouchableOpacity>
    </View>
    </TouchableOpacity>
    </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#2c3e50', borderBottomWidth: 0.5, borderColor: '#34495e' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  profileBtn: { padding: 4 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#3498db', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', alignItems: 'flex-end' },
  profileCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, margin: 16, marginTop: 60, minWidth: 220, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  profileHeader: { alignItems: 'center', marginBottom: 16 },
  avatarLarge: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#3498db', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarLargeText: { color: '#fff', fontWeight: '700', fontSize: 24 },
  profileEmail: { fontSize: 14, color: '#555', textAlign: 'center' },
  signOutBtn: { backgroundColor: '#fdedec', borderRadius: 8, padding: 12, alignItems: 'center' },
  signOutText: { color: '#e74c3c', fontWeight: '600', fontSize: 15 },
})

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isRecovering, setIsRecovering] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [chargesSynced, setChargesSynced] = useState(false)
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
  
  if (loading) return null
  if (session && isRecovering) return <ResetPasswordScreen onDone={() => setIsRecovering(false)} />
  if (!session) return <AuthScreen key={linkError ?? "auth"} initialError={linkError} />
  if (!chargesSynced) return null
  
  return (
    <ErrorBoundary>
    <ToastContext.Provider value={{ showToast }}>
    <View style={{ flex: 1 }}>
    <Header userEmail={session.user.email} />
    <NavigationContainer>
    <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarIcon: ({ focused, color, size }) => {
        let iconName: any
        if (route.name === 'Dashboard') iconName = focused ? 'home' : 'home-outline'
        else if (route.name === 'Transactions') iconName = focused ? 'list' : 'list-outline'
        else if (route.name === 'Subscriptions') iconName = focused ? 'repeat' : 'repeat-outline'
        else if (route.name === 'Budget') iconName = focused ? 'bar-chart' : 'bar-chart-outline'
        else if (route.name === 'Settings') iconName = focused ? 'settings' : 'settings-outline'
        return <Ionicons name={iconName} size={size} color={color} />
      },
      tabBarActiveTintColor: '#2980b9',
      tabBarInactiveTintColor: '#888',
    })}
    >
    <Tab.Screen name="Dashboard" component={Dashboard} />
    <Tab.Screen name="Transactions" component={TransactionsScreen} />
    <Tab.Screen name="Subscriptions" component={SubscriptionsScreen} />
    <Tab.Screen name="Budget" component={BudgetScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
    </NavigationContainer>
    <Toast
    message={toast.message}
    type={toast.type}
    visible={toast.visible}
    onHide={hideToast}
    />
    </View>
    </ToastContext.Provider>
    </ErrorBoundary>
  )
}