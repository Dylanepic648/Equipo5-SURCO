import { supabase } from './supabase.js'

const LoginForm = document.getElementById('loginForm')
const Correo = document.getElementById('email')
const Contraseña = document.getElementById('password')

LoginForm.addEventListener('submit', async (e) => {
  e.preventDefault()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: Correo.value,
    password: Contraseña.value,
  })
  if (error) return alert(error.message)

  const { data: u, error: errU } = await supabase
    .from('usuarios').select('rol, activo').eq('id', data.user.id).single()

  if (errU || !u?.activo) {
    await supabase.auth.signOut()
    return alert('Usuario inactivo o sin perfil')
  }

  window.location.href = './pages/modulo2(operaciones)/operaciones.html'
})
