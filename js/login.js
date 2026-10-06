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
    console.log(data, error)
})

if (supabase.auth.user() !== null) {
    window.location.href = './pages/index.html'
}