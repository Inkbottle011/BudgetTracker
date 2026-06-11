import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const SUPABASE_URL = 'https://xvnzbseochefpuuzkhql.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2bnpic2VvY2hlZnB1dXpraHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzI3MzcsImV4cCI6MjA5NTQwODczN30.ThPixnyJuG6ALqnMvRPzMOzj9SpwM3mLhfqUeDXs4wE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: {
    headers: {},
  },
})