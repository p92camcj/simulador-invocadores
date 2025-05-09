
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
      versionDiv.title = 'Ver historial de cambios';
      versionDiv.textContent = currentVersion;

      versionDiv.addEventListener('click', () => {
        window.open('https://github.com/p92camcj/simulador-invocadores/blob/main/CHANGELOG.md', '_blank');
      });

      document.body.appendChild(versionDiv);

      // Comparar con la última versión publicada en GitHub
      fetch('https://api.github.com/repos/p92camcj/simulador-invocadores/releases/latest')
        .then(response => response.json())
        .then(release => {
          if (release.tag_name && release.tag_name !== currentVersion) {
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
            updateDiv.title = 'Haz clic para ver los cambios';

            updateDiv.addEventListener('click', () => {
              window.open('https://github.com/p92camcj/simulador-invocadores/blob/main/CHANGELOG.md', '_blank');
            });

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
