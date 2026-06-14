import { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native'
import { supabase } from './lib/supabase'
import Dashboard from './app/index'
import AuthScreen from './app/auth'
import TransactionsScreen from './app/transactions/index'
import BudgetScreen from './app/budget/index'
import SettingsScreen from './app/settings'
import { ErrorBoundary } from './components/ErrorBoundary'

const Tab = createBottomTabNavigator()

function Header({ userEmail }: { userEmail: string }) {
  const [showProfile, setShowProfile] = useState(false)
  
  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()
    if (error) Alert.alert('Error', error.message)
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
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    
    return () => subscription.unsubscribe()
  }, [])
  
  if (loading) return null
  if (!session) return <AuthScreen />
  
  return (
    <ErrorBoundary>
    <View style={{ flex: 1 }}>
    <Header userEmail={session.user.email} />
    <NavigationContainer>
    <Tab.Navigator screenOptions={{ headerShown: false }}>
    <Tab.Screen name="Dashboard" component={Dashboard} />
    <Tab.Screen name="Transactions" component={TransactionsScreen} />
    <Tab.Screen name="Budget" component={BudgetScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
    </NavigationContainer>
    </View>
    </ErrorBoundary>
  )
}