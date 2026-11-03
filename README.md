# 🧠 Noche de Genios · Club GEI

Juego por equipos para eventos del club: trivia con puntos por velocidad, "más cerca gana", desafíos de foto y búsqueda del tesoro con QR. Cada mesa juega desde un celular, sin instalar nada.

## Las tres pantallas

| Para quién | Dirección | Qué hace |
|---|---|---|
| **Conductor** | `/` | La consola. Pide el PIN. Desde acá lanzás preguntas, aprobás fotos y manejás los puntos. |
| **Proyector** | `/pantalla` | Se abre con el botón **📺 Abrir proyector** de la consola. Arrastrá esa ventana al proyector y tocá **Pantalla completa**. |
| **Jugadores** | `/jugar` | Cada mesa entra escaneando el QR que muestra el proyector. |

Cuando la consola está en **Inicio**, el proyector muestra la **tabla de posiciones con todos los equipos** y el QR para sumarse.

PIN por defecto: `genio2026` (ver "Cambiar el PIN").

---

## Opción A · Publicarla en internet con Render (recomendada)

Así cada uno juega con sus propios datos móviles y no dependés del wifi del club.

1. Entrá a [render.com](https://render.com) y creá una cuenta con **"Sign in with GitHub"**.
2. Tocá **New +** → **Blueprint** y elegí el repositorio `pablog2081/noche-de-genios`.
3. Render lee el archivo `render.yaml` y te pide el valor de **PIN**: escribí el PIN que quieras para la consola.
4. Tocá **Apply** y esperá unos minutos. Te da una dirección del estilo `https://noche-de-genios.onrender.com`.
5. Esa dirección es la consola. El proyector y los QR ya usan esa misma dirección solos.

**Ojo con el plan gratuito de Render:**
- Si nadie lo usa durante 15 minutos, se "duerme". **Abrí la consola unos minutos antes del evento** para despertarlo; el primer ingreso puede tardar hasta un minuto.
- Si el servicio se reinicia, se borran las fotos guardadas. Los puntos y las preguntas quedan guardados en la compu de la consola y se vuelven a cargar solos.
- Cada vez que se sube un cambio a GitHub, Render actualiza la app sola.

## Opción B · Correrla en tu compu con el wifi del club

1. Descargá el repositorio (botón verde **Code** → **Download ZIP**) y descomprimilo.
2. Hacé doble clic en **`iniciar.bat`**. La primera vez instala lo necesario (hace falta internet ese rato).
3. Si Windows pregunta por el **Firewall**, tocá **Permitir acceso** en *Redes privadas*.
4. La ventana negra muestra las direcciones (por ejemplo `http://192.168.0.15:3000`). **No la cierres** durante el evento.
5. Los celulares tienen que estar conectados **al mismo wifi** que la compu.

---

## Cómo se juega

1. **Inicio:** abrí el proyector desde la consola. Las mesas escanean el QR y escriben el nombre del equipo. Si varios de la mesa ponen el mismo nombre, quedan juntos.
2. **Juego en vivo:** elegí la ronda y tocá **▶ Lanzar** en cada pregunta.
   - Opción múltiple: 500 puntos por acertar + hasta 500 por velocidad.
   - Más cerca gana: 1000 / 700 / 500 / 300 / 150 para los cinco más cercanos, +500 si es exacto.
   - La respuesta se revela sola cuando se termina el tiempo o cuando respondieron todos.
3. **Desafíos de foto:** los equipos sacan la foto desde el celu y te llega a la consola para aprobarla. Las aprobadas aparecen en el proyector.
4. **Tesoro:** escondé las tarjetas por el club (se imprimen desde la pestaña **Tesoro** → **🖨️ Abrir para imprimir**, o en `/tarjetas`). Activá la búsqueda desde la consola. Al escanear una tarjeta con la cámara, el código se carga solo.
5. **🏆 Podio** para cerrar la noche.

Para ensayar sin celulares: pestaña **Equipos** → **🤖 Agregar 5 equipos de prueba**. Responden solos.

## Editar las preguntas

En la consola, pestaña **✏️ Preguntas**: podés agregar, editar, ordenar y borrar preguntas, desafíos y rondas. La ronda **"Nuestro club"** trae preguntas de ejemplo para completar con datos reales.

## Cambiar el PIN

- En Render: **Environment** → variable `PIN`.
- En tu compu: abrí `iniciar.bat` con el Bloc de notas y agregá `set PIN=tuPin` antes de la línea `node server.js`.
