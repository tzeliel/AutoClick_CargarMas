# ⚡ Auto Load More

> *Automate the boring stuff, investigate the interesting stuff.*

Pequeño script JavaScript para automatizar el botón **`Cargar más`** en páginas web.

El script busca automáticamente el botón visible, simula la secuencia de eventos de ratón y espera unos segundos antes de volver a buscarlo.

En otras palabras:

**Tú:** `Cargar más`
**Script:** *"Ya lo hago yo."*

---

## 🧠 ¿Qué hace?

El proceso es bastante sencillo:

```text
┌──────────────────────────┐
│ Buscar "Cargar más"      │
└────────────┬─────────────┘
             │
             ▼
      ¿Botón visible?
        /         \
      NO           SÍ
      │             │
      ▼             ▼
    STOP      Simular click
                    │
                    ▼
              Esperar 2.5s
                    │
                    └──────► Repetir
```

El script:

* Busca elementos cuyo texto sea exactamente `Cargar más`.
* Comprueba que sean visibles.
* Obtiene las coordenadas del elemento.
* Simula `mousedown`.
* Simula `mouseup`.
* Simula `click`.
* Espera **2,5 segundos**.
* Repite hasta que el botón desaparezca.

---

## 🚀 Uso

1. Abre la página donde quieras cargar más contenido.
2. Abre las herramientas de desarrollador del navegador.
3. Ve a la pestaña **Console**.
4. Pega el contenido de `auto-load-more.js`.
5. Pulsa `Enter`.
6. Deja que haga su trabajo.

Salida aproximada:

```text
Clic 1
Clic 2
Clic 3
Clic 4
Clic 5
...
No encuentro el botón "Cargar más".
Proceso terminado. Total de clics: 42
```

42 clics.

Porque obviamente necesitábamos automatizar exactamente eso.

---

## ⚙️ Configuración

Puedes modificar fácilmente estos valores:

```javascript
const DELAY = 2500;
const BUTTON_TEXT = 'Cargar más';
```

Por ejemplo:

```javascript
const DELAY = 5000;
const BUTTON_TEXT = 'Load more';
```

Así esperará 5 segundos entre clics y buscará `Load more`.

---

## 🛠️ Estructura

```text
.
├── auto-load-more.js
└── README.md
```

Pequeño. Directo. Sin 14 frameworks para pulsar un botón.

---

## 🔍 ¿Por qué simula los eventos?

En lugar de limitarse a ejecutar una función arbitraria, el script reproduce la secuencia:

```text
mousedown
   ↓
mouseup
   ↓
click
```

utilizando las coordenadas reales del elemento.

Esto puede resultar útil en interfaces donde el comportamiento está asociado a eventos de ratón.

---

## ⚠️ Limitaciones

Este script no intenta ser un crawler universal ni pretende derrotar a Skynet.

Está pensado para páginas relativamente sencillas donde:

* El botón contiene exactamente `Cargar más`.
* El botón está presente en el DOM.
* El botón es visible.
* La página carga contenido después del clic.
* El contenido no requiere interacción adicional.

Puede no funcionar correctamente si la página utiliza:

* Shadow DOM.
* Iframes.
* Texto diferente.
* Botones generados con estructuras poco convencionales.
* Infinite scroll en lugar de botón.
* Sistemas anti-bot.
* Lógica que requiere eventos específicos del framework.

---

## 🧪 Personalización

Si la página utiliza otro texto:

```javascript
const BUTTON_TEXT = 'Ver más';
```

Si necesitas cambiar el intervalo:

```javascript
const DELAY = 1000;
```

Si quieres hacerlo más conservador:

```javascript
const DELAY = 5000;
```

La regla es sencilla:

> **Más rápido no es necesariamente mejor aunque puede ser cuantiosamente mejor.**

Deja que la página respire.

---

Haz con él lo que quieras. Preferiblemente cosas útiles.

---

## 👤 Author

**Zyanetralys**
