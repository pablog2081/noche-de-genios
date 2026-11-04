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

1. **Equipos:** antes de empezar, cargá los equipos en la pestaña **👥 Equipos**. Cada uno recibe un color, que se puede cambiar, y ese color es el fondo del celular de sus jugadores.
2. **Inicio:** abrí el proyector desde la consola. Cada persona escanea el QR, elige su equipo de la lista y escribe su nombre. En Inicio el proyector rota entre la tabla por equipos, la tabla individual, el buffet y los precios. Tocar la pestaña **🏠 Inicio** vuelve el proyector a esa cartelera.
3. **Juego en vivo:** elegí la ronda y tocá **▶ Lanzar**. Arriba de la lista podés cambiar los **segundos para responder** y los **puntos a repartir** de la ronda. Responde **cada jugador** desde su celular.
4. **Desafíos de foto:** los equipos sacan la foto desde el celu y te llega a la consola para aprobarla.
5. **Tesoro:** escondé las tarjetas por el club (pestaña **Tesoro** → **🖨️ Abrir para imprimir**). Al escanear una tarjeta, el código se carga solo.
6. **🏆 Podio** para cerrar la noche, con el mejor jugador.

### Puntuación

Cada pregunta tiene puntos para repartir, 1000 por defecto y el doble en la ronda x2. Se reparten **dos veces**: una entre equipos y otra entre jugadores.

- **Equipos:** califican los que tuvieron el **50% o más de aciertos** entre sus jugadores. Cada uno recibe una parte proporcional a **% de aciertos × rapidez**. La rapidez va de 1 (respondieron al instante) a 0,5 (al final del tiempo) y se calcula con el **tiempo promedio** de los jugadores del equipo.
- **Jugadores:** los mismos puntos se reparten entre los que acertaron, según la rapidez de cada uno.
- **Más cerca gana:** cuenta el **promedio** de los números del equipo; el más cercano y rápido se lleva más. Califica el equipo si respondió al menos la mitad.

### Juegos incluidos

- **Trivia, Bien argentina, Nuestro club y Doble o nada:** opción múltiple.
- **Más cerca gana:** responden un número.
- **Adiviná el emoji:** refranes con emojis.
- **Descubrí el tema:** el fragmento suena en la ventana del proyector y al revelar se pasa el video. Antes de empezar tocá **🔊 Activar sonido** en el proyector.
- **Banderas:** 12 banderas ya cargadas.
- **Adiviná el lugar** y **Marcas por el logo:** subí las fotos o logos desde **✏️ Preguntas**.
- **Sombras:** subí la foto de un objeto y la app lo muestra como silueta; al revelar aparece la foto real. Funciona mejor con fondos lisos o PNG sin fondo.
- **Desafíos con el celu** y **búsqueda del tesoro**.

Las imágenes que subís quedan guardadas en la compu de la consola y se vuelven a mandar al servidor solas si hace falta. Por eso conviene usar **siempre la misma compu y el mismo navegador** para la consola.

Para ensayar sin celulares: pestaña **Equipos** → **🤖 Agregar 5 equipos de prueba**. Cada equipo tiene 3 jugadores simulados que responden solos.

## Editar las preguntas

En la consola, pestaña **✏️ Preguntas**: podés agregar, editar, ordenar y borrar preguntas, desafíos y rondas, y elegir el tipo de cada pregunta. Cada pregunta puede tener su propio tiempo y sus propios puntos. La ronda **"Nuestro club"** trae preguntas de ejemplo para completar con datos reales.

## Cambiar el PIN

- En Render: **Environment** → variable `PIN`.
- En tu compu: abrí `iniciar.bat` con el Bloc de notas y agregá `set PIN=tuPin` antes de la línea `node server.js`.
