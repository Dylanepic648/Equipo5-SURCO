import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://yflbayfpzrnlqpfwsyxw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmbGJheWZwenJubHFwZndzeXh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNzIxNjQsImV4cCI6MjEwNTk0ODE2NH0.amJVZw1DE40tyAu0VdaUrNt8gBFXBeZI4DKVDZukC-w'

export const supabase = createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            autoRefreshToken: navigator.onLine,
            persistSession: true,
            detectSessionInUrl: false
        }
    }
)

export const LOGIN = new URL('../login.html', import.meta.url).href

export async function cerrarSesion() {
  localStorage.removeItem('surco_usuario')
  const { error } = await supabase.auth.signOut()
  if (error) return alert(error.message)
  location.replace(LOGIN)
}