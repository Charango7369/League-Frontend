# 🏆 ApoloDigital League — Edición 4League (Bolivia) 🇧🇴

> **Gestor profesional de torneos y ligas deportivas con la esencia e identidad visual de [apolodigital.lat](https://apolodigital.lat)**.
> Creado en la carpeta `d:\Apps\Apolodigital-League`.

---

## 🌟 ¿Qué es Apolodigital League?

Es una versión limpia, ágil y moderna inspirada en las funciones esenciales de **4League**, diseñada para la gestión integral de ligas de fútbol (11, 7, futsal y torneos zonales) de **Apolo y la provincia Franz Tamayo (La Paz, Bolivia)**.

---

## ⚽ Funcionalidades Esenciales de 4League Incluidas

1. **Gestión de Torneo y Configuración**:
   - Ajustes de duración de partido (90', 70', 50', 40' para futsal).
   - Nombres de campeonato, sede, organizador y temporada.
2. **Generador Automático de Calendario / Fixture (Algoritmo de Berger)**:
   - Generación matemática de todas las jornadas con 1 solo clic.
   - Opción para generar Solo Ida o Ida y Vuelta.
   - Distribución automática de fechas, horarios y canchas locales.
3. **Acta Digital y Marcador en Vivo (Match Center / Smart Referee)**:
   - Control de marcador en directo (+ / - goles).
   - Cronómetro de minutos en juego con avances rápidos (+1', +5', 45').
   - Registro de incidencias minuto a minuto: Goles normales, Penales, Autogoles, Tarjetas Amarillas y Rojas.
   - Asignación de goles al jugador correspondiente.
4. **Tabla de Posiciones Automática en Tiempo Real**:
   - Cálculo automático de PJ, G, E, P, GF, GC, DG y Puntos al guardar cada partido.
   - Indicadores visuales de posición: Zona de Campeón (Oro), Zona de Liguilla (Verde) y Descenso (Rojo).
   - Racha y forma de los últimos 5 partidos (V, E, D).
   - Descarga de tabla en formato **CSV**.
5. **Clubes y Plantillas de Jugadores**:
   - Registro de equipos con escudos vectoriales personalizables (colores y siglas).
   - Plantilla completa de jugadores con dorsal, nombre, posición (Portero, Defensa, Centrocampista, Delantero) y estadísticas individuales.
6. **Tabla de Goleadores (Pichichi) & Fair Play**:
   - Ranking de máximos anotadores del campeonato con podio de medallas.
   - Tabla disciplinaria de amonestaciones y expulsiones.
   - Métricas de mejor ataque y valla menos batida.
7. **Playoffs y Eliminatorias Directas (Brackets)**:
   - Cuadro interactivo de Cuartos de Final, Semifinales y Gran Final con proclamación de Campeón.
   - Botón para sembrar automáticamente los cruces según la tabla de posiciones.
8. **Modo Dual de Visualización & Pantalla Gigante / TV Estadio**:
   - **Modo Web / Desktop**: Panel amplio de administración.
   - **Modo App 4League (Móvil)**: Simulador de teléfono con barra inferior (Bottom Navigation) idéntica a la experiencia en smartphone.
   - **Modo TV Estadio / Broadcast**: Rotación de 4 canales en pantalla gigante para proyectores y streaming en vivo.
9. **Módulo Arbitral & Designaciones Oficiales**:
   - Padrón oficial del Colegio de Árbitros de Franz Tamayo con licencias FBF/FIFA y credenciales digitales con código QR.
   - Asignación reglamentaria de terna arbitral (Principal, Asistente 1, Asistente 2, 4to Árbitro) con auto-sugerencia inteligente.
   - Cierre y firma digital del acta con sello criptográfico SHA-256 inmutable.
10. **Generación y Descarga de Actas Oficiales en PDF (FBF / A4)**:
   - Exportación e impresión directa de planillas reglamentarias de juego en formato A4 vectorial.
   - Nóminas completas con C.I. boliviano, dorsales, firmas de filiación, cronología minutada de incidencias y casillas de firma oficial.

---

## 🎨 Toque y Detalles de Apolodigital.lat Incorporados

- **Paleta de Colores Oficial de apolodigital.lat**:
  - Azul Profundo Espacial (`--blue-deep: #0a1628`)
  - Azul Marino Superficie (`--blue-mid: #0d2347`)
  - Azul Eléctrico Marca (`--blue-brand: #1a4fd6`, `#3b82f6`, `#60a5fa`)
  - Dorado Andino / Oro Boliviano (`--gold: #f0b429`, `#fbbf24`)
  - Textos suaves (`#f0f6ff`, `#c8deff`)
- **Tipografía Oficial**:
  - `Syne` para títulos, marcadores, logotipos y dorsales.
  - `DM Sans` para tablas, estadísticas y textos.
- **Textura de Ruido Sutil**:
  - Filtro SVG idéntico al de la web oficial de Apolodigital.
- **Identidad Regional de Apolo y Bolivia**:
  - Equipos locales precargados de la región: *Club Apolo F.C.*, *Deportivo Franz Tamayo*, *Atlético Madidi*, *Real Machariapo*, *Juventud Atén*, *Tigres del Norte*, *Rangers*, *Unión Pauje-Yuyo*.
  - Sede: *Apolo, Franz Tamayo · La Paz, Bolivia 🇧🇴*.
- **Herramienta Exclusiva de Difusión para WhatsApp**:
  - Generador de reportes formateados con emojis y tipografía lista para compartir en grupos de delegados y capitanes.
  - Opciones de reporte: Tabla de posiciones, Resultados de la fecha o Próximos partidos.
  - Enlace directo al WhatsApp de soporte de Apolodigital: `+591 765 09789`.
- **Persistencia con LocalStorage**:
  - Toda modificación de partidos, goles o equipos queda guardada en el navegador automáticamente.

---

## 🚀 Cómo Iniciar la Aplicación

### Opción 1: Con el ejecutable directo
Doble clic en el archivo:
```
d:\Apps\Apolodigital-League\iniciar.bat
```

### Opción 2: Desde la consola / terminal
```powershell
cd d:\Apps\Apolodigital-League
npm run dev
```
Luego abre tu navegador en:
```
http://localhost:5173
```

### Opción 3: Previsualizar la versión construida (dist)
El proyecto ya está pre-compilado en la carpeta `dist/`. Puedes servirlo con:
```powershell
npm run preview
```

---

*Desarrollado con pasión para el deporte boliviano por **Apolodigital.lat** (Apolo, Franz Tamayo, La Paz).*
