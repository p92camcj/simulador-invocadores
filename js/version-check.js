
// Caché del texto de NOVEDADES.md: se rellena en el primer clic sobre el
// número de versión o el aviso de actualización, y se reutiliza en clics
// siguientes para no repetir el fetch.
let novedadesCache = null;
let novedadesModalEls = null;

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function aplicarNegrita(str) {
  return escapeHtml(str).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/**
 * Parser de Markdown mínimo, sin librerías externas: solo reconoce lo que
 * usa NOVEDADES.md realmente — '## ' como cabecera de versión, '- ' como
 * item de lista (con continuación en líneas siguientes sin ese prefijo,
 * por el ajuste de línea del propio archivo), '**texto**' como negrita, y
 * '---' como separador ignorado.
 */
function parseNovedadesMarkdown(text) {
  const lines = text.split('\n');
  const blocks = [];
  let currentList = null;

  lines.forEach(raw => {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      currentList = null;
      blocks.push({ type: 'h3', text: line.slice(3).trim() });
    } else if (line.startsWith('# ')) {
      currentList = null; // título de nivel superior, ya cubierto por el título del modal
    } else if (line === '---') {
      currentList = null;
    } else if (line.startsWith('- ')) {
      if (!currentList) {
        currentList = { type: 'ul', items: [] };
        blocks.push(currentList);
      }
      currentList.items.push(line.slice(2).trim());
    } else if (line === '') {
      // línea en blanco entre bloques, no requiere acción
    } else if (currentList && currentList.items.length) {
      // continuación de un item de lista partido en varias líneas
      currentList.items[currentList.items.length - 1] += ' ' + line;
    } else {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'p') {
        last.text += ' ' + line;
      } else {
        blocks.push({ type: 'p', text: line });
      }
    }
  });

  return blocks.map(b => {
    if (b.type === 'h3') return `<h3 class="novedades-version">${aplicarNegrita(b.text)}</h3>`;
    if (b.type === 'p') return `<p>${aplicarNegrita(b.text)}</p>`;
    if (b.type === 'ul') return `<ul>${b.items.map(i => `<li>${aplicarNegrita(i)}</li>`).join('')}</ul>`;
    return '';
  }).join('');
}

function crearModalNovedades() {
  const overlay = document.createElement('div');
  overlay.id = 'novedadesOverlay';
  overlay.className = 'modal-overlay hidden';

  const modal = document.createElement('div');
  modal.id = 'novedadesModal';
  modal.className = 'section modal-box';

  const title = document.createElement('div');
  title.className = 'play-title';
  const titleSpan = document.createElement('span');
  titleSpan.textContent = 'Novedades';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.textContent = '✖';
  closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  title.appendChild(titleSpan);
  title.appendChild(closeBtn);

  const content = document.createElement('div');
  content.id = 'novedadesContent';
  content.className = 'modal-content';

  modal.appendChild(title);
  modal.appendChild(content);
  overlay.appendChild(modal);

  // Clic fuera de la caja (sobre el overlay) también cierra el modal.
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });

  document.body.appendChild(overlay);
  return { overlay, content };
}

/**
 * Abre el modal de novedades. Fetch perezoso de NOVEDADES.md: solo la
 * primera vez que se abre, para no gastar una petición si nadie lo mira.
 */
function abrirNovedades() {
  if (!novedadesModalEls) novedadesModalEls = crearModalNovedades();
  novedadesModalEls.overlay.classList.remove('hidden');

  if (novedadesCache !== null) {
    novedadesModalEls.content.innerHTML = parseNovedadesMarkdown(novedadesCache);
    return;
  }

  novedadesModalEls.content.textContent = 'Cargando novedades…';
  fetch('./NOVEDADES.md')
    .then(res => res.text())
    .then(text => {
      novedadesCache = text;
      novedadesModalEls.content.innerHTML = parseNovedadesMarkdown(text);
    })
    .catch(err => {
      console.error('Error al leer NOVEDADES.md:', err);
      novedadesModalEls.content.textContent = 'No se pudieron cargar las novedades.';
    });
}

document.addEventListener('DOMContentLoaded', () => {
  fetch('./version.json')
    .then(res => res.json())
    .then(data => {
      const currentVersion = data.version || 'desconocida';

      // Mostrar versión en esquina inferior izquierda
      const versionDiv = document.createElement('div');
      versionDiv.id = 'version-info';
      versionDiv.style.position = 'fixed';
      versionDiv.style.bottom = '5px';
      versionDiv.style.left = '10px';
      versionDiv.style.fontSize = '11px';
      versionDiv.style.color = '#666';
      versionDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
      versionDiv.style.padding = '3px 6px';
      versionDiv.style.borderRadius = '4px';
      versionDiv.style.zIndex = '9999';
      versionDiv.style.cursor = 'pointer';
      versionDiv.title = 'Ver novedades';
      versionDiv.textContent = currentVersion;

      versionDiv.addEventListener('click', abrirNovedades);

      document.body.appendChild(versionDiv);

      // Comparar con la última versión publicada en GitHub.
      // Solo se compara X.Y.Z (release), ignorando W (nº de commit), que
      // cambia en cada push y no debe disparar el aviso de actualización.
      // La comparación es numérica y direccional: el aviso solo debe verse
      // si la Release es realmente MÁS NUEVA que version.json, no solo
      // "distinta" (si el código ya va por delante de la última Release
      // publicada, mostrar el aviso sería un falso positivo engañoso).
      const parseVersion = v => {
        const m = (v || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
        if (!m) return null;
        return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
      };
      const esVersionMayor = (a, b) => {
        for (let i = 0; i < 3; i++) {
          if (a[i] !== b[i]) return a[i] > b[i];
        }
        return false;
      };

      fetch('https://api.github.com/repos/p92camcj/simulador-invocadores/releases/latest')
        .then(response => response.json())
        .then(release => {
          if (!release.tag_name) return;

          const releaseVer = parseVersion(release.tag_name);
          const actualVer = parseVersion(currentVersion);
          if (!releaseVer || !actualVer) {
            console.warn(`No se pudo comparar versiones: release="${release.tag_name}", actual="${currentVersion}"`);
            return;
          }

          if (esVersionMayor(releaseVer, actualVer)) {
            const updateDiv = document.createElement('div');
            updateDiv.textContent = `¡Nueva versión disponible: ${release.tag_name}!`;
            updateDiv.style.position = 'fixed';
            updateDiv.style.top = '10px';
            updateDiv.style.right = '10px';
            updateDiv.style.padding = '8px 12px';
            updateDiv.style.fontSize = '13px';
            updateDiv.style.backgroundColor = '#ffe58a';
            updateDiv.style.border = '1px solid #ffc107';
            updateDiv.style.borderRadius = '6px';
            updateDiv.style.color = '#333';
            updateDiv.style.zIndex = '10000';
            updateDiv.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
            updateDiv.style.cursor = 'default';
            updateDiv.title = 'Haz clic para ver las novedades';

            updateDiv.addEventListener('click', abrirNovedades);

            const reloadBtn = document.createElement('button');
            reloadBtn.textContent = 'Actualizar ahora';
            reloadBtn.style.marginLeft = '10px';
            reloadBtn.style.padding = '4px 8px';
            reloadBtn.style.fontSize = '12px';
            reloadBtn.style.border = 'none';
            reloadBtn.style.borderRadius = '4px';
            reloadBtn.style.backgroundColor = '#6c4eb6';
            reloadBtn.style.color = '#fff';
            reloadBtn.style.cursor = 'pointer';

            reloadBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              window.location.reload(true);
            });

            updateDiv.appendChild(reloadBtn);
            document.body.appendChild(updateDiv);
          }
        });
    })
    .catch(err => console.error('Error al leer version.json:', err));
});
