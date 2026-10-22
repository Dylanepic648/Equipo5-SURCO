import { supabase } from './supabase.js'

const { data: { session } } = await supabase.auth.getSession()
if (!session) location.replace('../login.html')
else console.log('Sesion iniciada')

