// abilities.js
import { stackFrom, COMBOS, LEVELS, portalesConEstado, mostrarCarta, generarVis } from './utils.js';
import { picker, render } from './render.js';

function estaProtegido(stack) {
  return stack.length && stack.at(-1).name === 'Centinela' && stack.at(-1).vis?.public;
}

function jugadorProtegidoContraAprendiz(jugador, jugadores) {
  if (jugadores.length === 2) {
    return jugador.portals.some(estaProtegido);
  }
  if (jugador.portals.length === 1) {
    return estaProtegido(jugador.portals[0]);
  }
  return false;
}

export function applyAbility(name, ownerIdx, stack, players, neutrals, levelIdx) {
  const owner = players[ownerIdx];

  switch (name) {
    case 'Ocultista':
  const opciones = portalesConEstado(players, neutrals, st =>
    estaProtegido(st) || st.length === 0
  );

  picker('¿Qué portal quieres alterar?', opciones, key => {
    const st = stackFrom(key, players, neutrals);
    const carta = st.at(-1);
    carta.vis.public = !carta.vis.public;
    render(players, neutrals, levelIdx);
  });
  break;


  case 'Centinela':
  // Ocultar cualquier otra Centinela visible en top de cualquier portal
  players.forEach((p, i) =>
    p.portals.forEach((st, j) => {
      if (
        st !== stack && // evitar modificar el portal donde se ha jugado
        st.length &&
        st.at(-1).name === 'Centinela' &&
        st.at(-1).vis?.public
      ) {
        st.at(-1).vis.public = false;
      }
    })
  );

  neutrals.forEach(st => {
    if (st !== stack && st.length && st.at(-1).name === 'Centinela' && st.at(-1).vis?.public) {
      st.at(-1).vis.public = false;
    }
  });

  // No se toca la carta recién jugada (ya estará en el top y visible por defecto)
  break;


  case 'Cronista':
  const opcionesCronista = portalesConEstado(players, neutrals, st =>
    estaProtegido(st) || st.length === 0
  );

  picker('Portal objetivo', opcionesCronista, key => {
    const st = stackFrom(key, players, neutrals);
    const carta = st.pop();
    const vis = generarVis('mano', {
      origen: 'cronista',
      visible: carta.vis?.public === true,
      esPropietaria: true
    });
    owner.hand.push({ name: carta.name, vis });
    render(players, neutrals, levelIdx);
  });
  break;

  case 'Cronomante':
  const opcionesCrono = portalesConEstado(players, neutrals, st =>
    estaProtegido(st) || st.length <= 1
  );

  picker('Elige un portal para manipular', opcionesCrono, key => {
    const st = stackFrom(key, players, neutrals);
    const opcionesCarta = st.map((carta, idx) => ({
      val: idx,
      lbl: carta.vis?.public ? mostrarCarta(carta) : 'Carta Oculta'
    }));

    picker('¿Qué carta quieres subir al top?', opcionesCarta, idx => {
      const seleccionada = st.splice(idx, 1)[0];
      st.push(seleccionada);
      render(players, neutrals, levelIdx);
    });
  });
  break;

  case 'Estratega':
  const portalesValidos = portalesConEstado(players, neutrals, st => estaProtegido(st));

  picker('1er portal', portalesValidos, first => {
    picker(
      '2º portal',
      portalesValidos.filter(o => o.val !== first),
      second => {
        const s1 = stackFrom(first, players, neutrals);
        const s2 = stackFrom(second, players, neutrals);

        if (estaProtegido(s1) && estaProtegido(s2)) {
          alert('Ambos portales están protegidos por Centinela.');
          return;
        }
        if (estaProtegido(s1)) {
          s2.splice(0, s2.length, ...s1);
        } else if (estaProtegido(s2)) {
          s1.splice(0, s1.length, ...s2);
        } else {
          const tmp = [...s1];
          s1.splice(0, s1.length, ...s2);
          s2.splice(0, s2.length, ...tmp);
        }

        render(players, neutrals, levelIdx);
      }
    );
  });
  break;

  case 'Clarividente':
    // La habilidad de Clarividente se gestiona automáticamente por render()
    // mientras esté visible en el top de un portal del jugador.
    // No requiere acción directa en applyAbility.
    break;


    case 'Aprendiz':
  const opcionesAprendiz = players
    .map((p, i) => ({ val: i, lbl: p.name }))
    .filter(p => !jugadorProtegidoContraAprendiz(players[p.val], players));

  picker('Primera jugadora', opcionesAprendiz, v1 => {
    v1 = parseInt(v1);

    const segundaOpcion = opcionesAprendiz.filter(o => parseInt(o.val) !== v1);

    picker('Segunda jugadora', segundaOpcion, v2 => {
      v2 = parseInt(v2);

      // Intercambio de manos
      [players[v1].hand, players[v2].hand] = [players[v2].hand, players[v1].hand];

      // Inversión de visibilidad
      players[v1].hand.forEach(c => {
        const temp = c.vis.owner;
        c.vis.owner = c.vis.others;
        c.vis.others = temp;
      });

      players[v2].hand.forEach(c => {
        const temp = c.vis.owner;
        c.vis.owner = c.vis.others;
        c.vis.others = temp;
      });

      render(players, neutrals, levelIdx);
    });
  });
  break;

      

    case 'Metamorfo':
      const need = COMBOS[LEVELS[levelIdx]];
      const present = new Set();
      players.forEach(p =>
        p.portals.forEach(s => s.length && s.at(-1).vis && present.add(s.at(-1).name))
      );
      neutrals.forEach(s => s.length && s.at(-1).vis && present.add(s.at(-1).name));
      const miss = need.filter(n => !present.has(n));
      if (!miss.length || owner.gems < 1) return;
      picker(
        'Metamorfo cambia a',
        miss.map(m => ({ val: m, lbl: m })),
        v => {
          owner.gems--;
          stack.at(-1).name = v;
        }
      );
      break;

    default:
      break;
  }
}
