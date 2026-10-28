const menu = document.getElementById('menu');
const sidebar = document.getElementById('sidebar');
const main = document.getElementById('main');

function aplicar(abierto) {
    sidebar.classList.toggle('menu-toggle', abierto);
    menu.classList.toggle('menu-toggle', abierto);
    main.classList.toggle('menu-toggle', abierto);
}

sidebar.addEventListener('mouseenter', () => aplicar(true));
sidebar.addEventListener('mouseleave', () => aplicar(false));

import('./supabase.js');

function confirmarSalida() {
  return new Promise(resolve => {
    const d = document.createElement('dialog')
    d.className = 'dialogo'
    d.setAttribute('aria-label', 'Cerrar sesión')
    d.innerHTML = `
      <div class="dialogo__cuerpo">
        <h2 class="dialogo__titulo">Cerrar sesión</h2>
        <p class="dialogo__texto">¿Quieres cerrar sesión?</p>
        <div class="dialogo__pie">
          <button class="btn btn--secundario" type="button" data-no>Cancelar</button>
          <button class="btn" type="button" data-si>Cerrar sesión</button>
        </div>
      </div>`
    d.querySelector('[data-no]').onclick = () => d.close()
    d.querySelector('[data-si]').onclick = () => { d.returnValue = 'si'; d.close() }
    d.addEventListener('close', () => {
      d.remove()
      resolve(d.returnValue === 'si')
    })
    document.body.append(d)
    d.showModal()
  })
}

document.getElementById('btnSalir')?.addEventListener('click', async e => {
  e.preventDefault()
  e.stopImmediatePropagation()
  if (!await confirmarSalida()) return
  const { supabase } = await import('./supabase.js')
  await supabase.auth.signOut()
  location.href = '/login.html'
}, true)