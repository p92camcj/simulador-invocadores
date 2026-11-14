// js/red/panel-online.js
//
// Panel "Jugar online" de la pantalla de inicio: crear una sala (esta
// pantalla hace de mesa) o unirse a la de otra persona con su código o su
// enlace. La lógica de la sala está en js/red/sala.js.

import {
  rolRed, codigoSala, crearSala, cerrarSala, unirse, salirDeSala, personasEnSala,
  escucharSala, enlaceSala, limpiarCodigo, ultimoError, salaAnteriorDeEstaPestana, olvidarSalaAnterior, borrarErrorRed,
} from './sala.js';

const CLAVE_NOMBRE = 'invocadores.nombreOnline';
let vista = 'inicio';     // 'inicio' | 'unirse' (sin sala); con sala manda el rol
let ocupado = false;
let enlazado = false;

const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function leerNombre() {
  try { return localStorage.getItem(CLAVE_NOMBRE) || ''; } catch { return ''; }
}
function guardarNombre(n) {
  try { localStorage.setItem(CLAVE_NOMBRE, n); } catch { /* nada */ }
}

/** Se llama desde initSetup() cada vez que se enseña la pantalla de inicio. */
export function initPanelOnline() {
  if (!enlazado) {
    enlazado = true;
    escucharSala(pintar);
    // Enlace de invitación: ?sala=CÓDIGO abre directamente "Unirme".
    const cod = new URLSearchParams(location.search).get('sala');
    if (cod) {
      vista = 'unirse';
      pintar.codigoInicial = limpiarCodigo(cod);
    }
    // Se ha recargado la página (o se vuelve a la app) en mitad de una sala:
    // se vuelve a entrar sola. Pero si llega un enlace de OTRA sala, manda
    // el enlace: la sala anterior se olvida.
    const enlace = cod ? limpiarCodigo(cod) : '';
    const anterior = salaAnteriorDeEstaPestana();
    if (anterior && enlace && limpiarCodigo(anterior.codigo) !== enlace) {
      olvidarSalaAnterior();
    } else if (anterior?.codigo && anterior?.nombre) {
      vista = 'unirse';
      pintar.codigoInicial = anterior.codigo;
      ocupado = true;
      unirse(anterior.codigo, anterior.nombre)
        .catch(() => {
          // Esa sala ya no está: se olvida sin dar guerra y se deja el campo
          // listo para escribir el código nuevo.
          olvidarSalaAnterior();
          borrarErrorRed();
          pintar.codigoInicial = enlace;
          if (!enlace) vista = 'inicio';
        })
        .finally(() => { ocupado = false; pintar(); });
    }
  }
  pintar();
}

function pintar() {
  const panel = document.querySelector('#panelOnline');
  if (!panel) return;
  const rol = rolRed();
  document.querySelector('#setup')?.classList.toggle('setup-invitada', rol === 'invitada');
  if (rol === 'anfitriona') pintarAnfitriona(panel);
  else if (rol === 'invitada') pintarInvitada(panel);
  else if (vista === 'unirse') pintarUnirse(panel);
  else pintarInicio(panel);
}

function pintarInicio(panel) {
  const error = ultimoError();
  panel.innerHTML = `
    <strong>🌐 Jugar online</strong>
    <p>Cada persona en su casa, con su móvil o su ordenador. Quien crea la sala hace de mesa y tiene que tener la app abierta durante la partida.</p>
    ${error ? `<p class="error-msg">${esc(error)}</p>` : ''}
    <button type="button" class="btn primary" data-red="crear" ${ocupado ? 'disabled' : ''}>${ocupado ? 'Abriendo sala…' : 'Crear sala'}</button>
    <button type="button" class="btn" data-red="ir-unirse">Unirme a una sala</button>`;
  panel.querySelector('[data-red="crear"]').onclick = async () => {
    ocupado = true;
    pintar();
    await crearSala();
    ocupado = false;
    pintar();
  };
  panel.querySelector('[data-red="ir-unirse"]').onclick = () => { vista = 'unirse'; pintar(); };
}

function pintarUnirse(panel) {
  const error = ultimoError();
  const codigo = pintar.codigoInicial || '';
  panel.innerHTML = `
    <strong>🌐 Unirme a una sala</strong>
    <p>Escribe el código que te ha pasado quien hace de mesa.</p>
    <label>Código de la sala: <input id="inpCodigoSala" type="text" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(codigo)}" placeholder="ABCDE"></label>
    <label>Tu nombre: <input id="inpNombreOnline" type="text" maxlength="24" value="${esc(leerNombre())}" placeholder="Tu nombre"></label>
    ${error ? `<p class="error-msg">${esc(error)}</p>` : ''}
    <button type="button" class="btn primary" data-red="entrar" ${ocupado ? 'disabled' : ''}>${ocupado ? 'Conectando…' : 'Entrar'}</button>
    <button type="button" class="btn" data-red="volver">Volver</button>`;
  const inpCodigo = panel.querySelector('#inpCodigoSala');
  const inpNombre = panel.querySelector('#inpNombreOnline');
  inpCodigo.addEventListener('input', () => { inpCodigo.value = limpiarCodigo(inpCodigo.value); pintar.codigoInicial = inpCodigo.value; });
  panel.querySelector('[data-red="volver"]').onclick = () => { vista = 'inicio'; pintar(); };
  panel.querySelector('[data-red="entrar"]').onclick = async () => {
    const cod = limpiarCodigo(inpCodigo.value);
    const nombre = inpNombre.value.trim();
    if (cod.length !== 5) { inpCodigo.focus(); return; }
    if (!nombre) { inpNombre.focus(); return; }
    guardarNombre(nombre);
    pintar.codigoInicial = cod;
    ocupado = true;
    pintar();
    try { await unirse(cod, nombre); } catch { /* el error se enseña en el panel */ }
    ocupado = false;
    pintar();
  };
  if (!codigo) inpCodigo.focus();
}

function pintarAnfitriona(panel) {
  const codigo = codigoSala();
  const amigas = personasEnSala();
  const lista = ['<li>👤 Tú <span class="nota-red">(la mesa)</span></li>', ...amigas.map(n => `<li>👤 ${esc(n)} <span class="nota-red">conectada</span></li>`)].join('');
  panel.innerHTML = `
    <strong>🌐 Sala abierta</strong>
    <p class="codigo-sala">Código: <b>${esc(codigo)}</b></p>
    <button type="button" class="btn primary" data-red="invitar">📤 Invitar (enviar enlace)</button>
    <button type="button" class="btn" data-red="cerrar">Cerrar sala</button>
    <ul class="lista-sala">${lista}</ul>
    <p class="nota-setup">${amigas.length
      ? `Pon un asiento 👤 Persona por cada persona de la sala (${amigas.length + 1}): el primero es el tuyo y los siguientes, por orden de llegada. Los demás asientos pueden ser autómatas. Después, pulsa «Iniciar partida».`
      : 'Esperando a que alguien entre… Manda el enlace o el código por WhatsApp.'}</p>`;
  panel.querySelector('[data-red="cerrar"]').onclick = () => cerrarSala();
  panel.querySelector('[data-red="invitar"]').onclick = () => invitar(codigo);
}

async function invitar(codigo) {
  const url = enlaceSala();
  const texto = `¡Juguemos a Invocadores! Entra en la sala ${codigo}:`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Invocadores online', text: texto, url });
      return;
    }
  } catch { /* cancelado: se copia */ }
  try {
    await navigator.clipboard.writeText(`${texto} ${url}`);
    alert('Enlace copiado. Pégalo en WhatsApp o donde quieras.');
  } catch {
    prompt('Copia este enlace y envíalo:', url);
  }
}

function pintarInvitada(panel) {
  const nombres = personasEnSala();
  panel.innerHTML = `
    <strong>🌐 Estás en la sala ${esc(codigoSala())}</strong>
    <p>Esperando a que la mesa empiece la partida… Cuando empiece, la verás aquí.</p>
    ${nombres.length ? `<ul class="lista-sala"><li>👤 La mesa</li>${nombres.map(n => `<li>👤 ${esc(n)}</li>`).join('')}</ul>` : ''}
    <button type="button" class="btn" data-red="salir">Salir de la sala</button>`;
  panel.querySelector('[data-red="salir"]').onclick = () => { vista = 'inicio'; salirDeSala(); };
}
