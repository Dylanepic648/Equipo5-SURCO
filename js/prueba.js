const tbody = document.getElementById('cuerpo')
const thead = document.getElementById('cabeza')
const thinst = []
const trinst = []
const tdinst = []
let cantidadfilas = 4
let cantidadcolumnas = 8

for (k = 0; k < cantidadcolumnas; k++)
{
    thinst[k] = document.createElement('th')
    thinst[k].textContent = 'prueba'
    thinst[k].className = 'th-class'
    thinst[k].id = 'th-id'
    thead.appendChild(thinst[k])
}
for (j = 0; j < cantidadfilas; j++)
{
    trinst[j] = document.createElement('tr')
    trinst[j].className = 'tr-class'
    trinst[j].id = 'tr-id'
    tbody.appendChild(trinst[j])

    for (i = 0; i < thead.childElementCount; i++)
{ 
    tdinst[i] = document.createElement('td')
    tdinst[i].textContent = 'prueba'
    tdinst[i].className = 'td-class'
    tdinst[i].id = 'td-id'
    trinst[j].appendChild(tdinst[i])
}
}

