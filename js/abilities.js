// abilities.js
import { stackFrom, portalesConEstado, mostrarCarta, generarVis, gastarGemaUnitaria, PERSONAJES_NO_ANIMALES } from './utils.js';
import { picker } from './render.js';

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

/**
 * Aplica la habilidad de `name` al portal `stack`, propiedad de `players[ownerIdx]`.
 * `need` es el array de personajes requeridos por la invocación activa (según
 * el set de invocación elegido, ver INVOCATION_SETS en utils.js) — solo lo
 * usa el caso 'Metamorfo'. Pásalo explícitamente desde quien llame a esta
 * función; no lo recalcules aquí a partir de globals.
 *
 * `onComplete` se invoca UNA sola vez, justo en el punto donde la habilidad
 * se aplica de verdad (la mutación real del estado del juego) — nunca antes.
 * Si el jugador cancela cualquier picker() intermedio (Cronomante, Estratega,
 * Aprendiz, Metamorfo tienen uno o más pasos que se pueden cancelar a
 * medias), `onComplete` no se llama y no debe haber ocurrido ningún efecto
 * observable (ni gasto de Gemas, ni marcar la habilidad como usada — eso lo
 * decide quien llama, dentro de `onComplete`).
 */
export function applyAbility(name, ownerIdx, stack, players, neutrals, levelIdx, need = [], onComplete = () => {}) {
  const owner = players[ownerIdx];

  switch (name) {
    case 'Ocultista': {
      const opciones = portalesConEstado(players, neutrals, st =>
        estaProtegido(st) || st.length === 0
      );

      picker('¿Qué portal quieres alterar?', opciones, key => {
        const st = stackFrom(key, players, neutrals);
        const carta = st.at(-1);
        carta.vis.public = !carta.vis.public;
        onComplete();
      });
      break;
    }

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

    case 'Cronista': {
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
        onComplete();
      });
      break;
    }

    case 'Cronomante': {
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
          onComplete();
        });
      });
      break;
    }

    case 'Estratega': {
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

            onComplete();
          }
        );
      });
      break;
    }

    case 'Clarividente':
      // La habilidad de Clarividente se gestiona automáticamente por render()
      // mientras esté visible en el top de un portal del jugador.
      // No requiere acción directa en applyAbility.
      break;

    case 'Aprendiz': {
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

          onComplete();
        });
      });
      break;
    }

    case 'Metamorfo': {
      // Regla vigente (revisión de reglamento 2026-07-19, ver REGLAMENTO.md
      // "Metamorfo"): puede transformarse en cualquier personaje NO animal,
      // en cualquier momento de su turno, sin que haga falta acercar ni
      // completar ninguna invocación activa — y sin restringirse a lo que
      // esté en juego o quede en el mazo: puede imitar incluso a un
      // personaje cuyas dos copias se apartaron al azar al preparar la
      // partida. `need` ya no se usa en este case (se mantiene en la firma
      // de applyAbility por si Modo Experto lo necesita más adelante para la
      // invocación Asterisco, que exige que el Metamorfo conserve su aspecto
      // natural — ver docs/MEJORAS_FUTURAS.md, no conectado todavía).
      if (owner.gems.length === 0) {
        alert('No tienes ninguna Gema con la que pagar la transformación.');
        return;
      }

      // Se excluye 'Metamorfo' de las opciones: transformarse en sí mismo no
      // tendría efecto observable. Es una asunción razonable, no una regla
      // explícita del reglamento.
      const opciones = PERSONAJES_NO_ANIMALES.filter(n => n !== 'Metamorfo');

      picker(
        'Metamorfo cambia a',
        opciones.map(m => ({ val: m, lbl: m })),
        v => {
          // Coste propio del Metamorfo (siempre 1 Gema, independiente del
          // coste de activar un Portal central que ya se haya cobrado o se
          // vaya a cobrar en onComplete — ver REGLAMENTO.md, nota del
          // Metamorfo). Si no se puede pagar, no ha pasado nada: no se llama
          // a onComplete, así que tampoco se cobra el coste de Portal central.
          if (!gastarGemaUnitaria(owner)) return;
          stack.at(-1).name = v;
          onComplete();
        }
      );
      break;
    }

    default:
      break;
  }
}
