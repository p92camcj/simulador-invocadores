// abilities.js
import {
  stackFrom, portalesConEstado, mostrarCarta, generarVis, gastarGemaUnitaria,
  PERSONAJES_NO_ANIMALES, jugadoraProtegidaPorCentinela, estaProtegidoParaActivar
} from './utils.js';
import { picker } from './render.js';

/**
 * ¿Su propia carta superior es una Centinela visible? Restricción propia
 * de Ocultista, independiente de la protección de Portales: "esta
 * habilidad no puede ser aplicada sobre una Centinela que esté visible"
 * (REGLAMENTO.md) se aplica siempre, incluso a la propia dueña de esa
 * Centinela — a diferencia de `estaProtegidoParaActivar`, que sí exime a
 * la propia dueña.
 */
const esCentinelaVisible = st =>
  st.length && st.at(-1).name === 'Centinela' && st.at(-1).vis?.public;

/**
 * ¿Bloquea la Centinela que `jugadorIdx` sea elegido como una de las dos
 * jugadoras del intercambio del Aprendiz? Igual que con el resto de
 * habilidades, la protección exime a quien la activa cuando se elige a sí
 * misma (REGLAMENTO.md permite "puedes elegirte a ti").
 */
function jugadorProtegidoContraAprendiz(jugadorIdx, players, actingPlayerIdx) {
  if (jugadorIdx === actingPlayerIdx) return false;
  return jugadoraProtegidaPorCentinela(players[jugadorIdx]);
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
      const opciones = portalesConEstado(players, neutrals, (st, val) =>
        esCentinelaVisible(st) ||
        estaProtegidoParaActivar(val, st, players, ownerIdx) ||
        st.length === 0
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
      const opcionesCronista = portalesConEstado(players, neutrals, (st, val) =>
        estaProtegidoParaActivar(val, st, players, ownerIdx) || st.length === 0
      );

      picker('Portal objetivo', opcionesCronista, key => {
        const st = stackFrom(key, players, neutrals);
        const carta = st.pop();
        // La orientación en mano no depende de cómo estaba la carta en el
        // Portal, sino de lo que le falte a la mano para mantener el
        // invariante "una carta visible y una oculta" (ver REGLAMENTO.md,
        // "Cronista"): en el momento de activar esta habilidad la mano del
        // jugador activo tiene exactamente 1 carta (Fase A ya jugó la otra).
        const cartaRestante = owner.hand[0];
        const visible = cartaRestante?.vis?.owner !== true;
        const vis = generarVis('mano', {
          origen: 'cronista',
          visible,
          esPropietaria: true
        });
        owner.hand.push({ name: carta.name, vis });
        onComplete();
      });
      break;
    }

    case 'Cronomante': {
      const opcionesCrono = portalesConEstado(players, neutrals, (st, val) =>
        estaProtegidoParaActivar(val, st, players, ownerIdx) || st.length <= 1
      );

      picker('Elige un portal para manipular', opcionesCrono, key => {
        const st = stackFrom(key, players, neutrals);
        const opcionesCarta = st.map((carta, idx) => ({
          val: idx,
          lbl: carta.vis?.public ? mostrarCarta(carta) : 'Carta Oculta'
        }));

        // EXCEPCIÓN deliberada al patrón general de "cancelar nunca cuesta"
        // (ver la nota de `onComplete` en la cabecera de `applyAbility`): la
        // "investigación" de Cronomante (examinar la pila del Portal
        // elegido, ver REGLAMENTO.md) ya ocurrió al abrir ESTE picker,
        // independientemente de si después se reordena algo o no. Cancelar
        // aquí no debe permitir volver a "Activar habilidad" y examinar un
        // Portal DISTINTO gratis en el mismo turno, así que se llama a
        // onComplete() igualmente (queda marcada como usada) pero sin mover
        // ninguna carta. NO "corregir" esto para que cancelar sea gratis
        // como en el resto de habilidades — es intencional. El PRIMER
        // picker (elegir qué Portal investigar) sí sigue el patrón general:
        // cancelarlo no cuesta nada, porque ahí todavía no se ha examinado
        // ningún Portal.
        picker(
          '¿Qué carta quieres subir al top?',
          opcionesCarta,
          idx => {
            const seleccionada = st.splice(idx, 1)[0];
            st.push(seleccionada);
            onComplete();
          },
          () => onComplete()
        );
      });
      break;
    }

    case 'Estratega': {
      const portalesValidos = portalesConEstado(players, neutrals, (st, val) =>
        estaProtegidoParaActivar(val, st, players, ownerIdx)
      );

      picker('1er portal', portalesValidos, first => {
        picker(
          '2º portal',
          portalesValidos.filter(o => o.val !== first),
          second => {
            const s1 = stackFrom(first, players, neutrals);
            const s2 = stackFrom(second, players, neutrals);
            const p1Protegido = estaProtegidoParaActivar(first, s1, players, ownerIdx);
            const p2Protegido = estaProtegidoParaActivar(second, s2, players, ownerIdx);

            if (p1Protegido && p2Protegido) {
              alert('Ambos portales están protegidos por Centinela.');
              return;
            }
            if (p1Protegido) {
              s2.splice(0, s2.length, ...s1);
            } else if (p2Protegido) {
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
        .filter(p => !jugadorProtegidoContraAprendiz(p.val, players, ownerIdx));

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
