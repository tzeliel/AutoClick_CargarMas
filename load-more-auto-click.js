```javascript
(async () => {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────────────────────

  const CONFIG = {
    buttonText: 'Cargar más',

    // Tiempo máximo para esperar cambios después de un clic.
    loadTimeout: 15_000,

    // Tiempo mínimo entre clics.
    clickDelay: 2_500,

    // Número máximo de clics permitidos.
    maxClicks: 100,

    // Cada cuánto comprobamos si el DOM ha cambiado.
    pollInterval: 250,

    // Elemento usado para detectar cambios.
    // Puedes cambiarlo si conoces un contenedor específico.
    containerSelector: 'body'
  };

  // ─────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────

  let clicks = 0;
  let lastClickTime = null;
  const startTime = performance.now();

  // ─────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────

  const wait = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  const timestamp = () => {
    const now = new Date();

    return now.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const elapsed = () =>
    ((performance.now() - startTime) / 1000).toFixed(3);

  const log = message => {
    console.log(
      `[${timestamp()}] ${message}`
    );
  };

  // ─────────────────────────────────────────────────────────────
  // FIND BUTTON
  // ─────────────────────────────────────────────────────────────

  const findLoadMoreButton = () => {
    return [...document.querySelectorAll('*')]
      .find(element =>
        element.textContent?.trim() === CONFIG.buttonText &&
        element.offsetParent !== null
      );
  };

  // ─────────────────────────────────────────────────────────────
  // DOM SNAPSHOT
  // ─────────────────────────────────────────────────────────────

  const getSnapshot = () => {
    const container =
      document.querySelector(CONFIG.containerSelector);

    if (!container) {
      return null;
    }

    return {
      childCount: container.children.length,
      textLength: container.textContent?.length ?? 0,
      htmlLength: container.innerHTML.length
    };
  };

  const hasChanged = before => {
    const after = getSnapshot();

    if (!before || !after) {
      return false;
    }

    return (
      after.childCount !== before.childCount ||
      after.textLength !== before.textLength ||
      after.htmlLength !== before.htmlLength
    );
  };

  // ─────────────────────────────────────────────────────────────
  // WAIT FOR CONTENT
  // ─────────────────────────────────────────────────────────────

  const waitForContentChange = async before => {
    const timeout = performance.now() + CONFIG.loadTimeout;

    while (performance.now() < timeout) {
      if (hasChanged(before)) {
        return true;
      }

      await wait(CONFIG.pollInterval);
    }

    return false;
  };

  // ─────────────────────────────────────────────────────────────
  // SIMULATE CLICK
  // ─────────────────────────────────────────────────────────────

  const simulateClick = element => {
    const rect = element.getBoundingClientRect();

    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    ['mousedown', 'mouseup', 'click'].forEach(type => {
      element.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX,
          clientY
        })
      );
    });
  };

  // ─────────────────────────────────────────────────────────────
  // MAIN LOOP
  // ─────────────────────────────────────────────────────────────

  log('▶ Auto Load More iniciado');

  log(
    `Configuración | ` +
    `Delay: ${CONFIG.clickDelay}ms | ` +
    `Timeout: ${CONFIG.loadTimeout}ms | ` +
    `Max clicks: ${CONFIG.maxClicks}`
  );

  try {
    while (clicks < CONFIG.maxClicks) {

      const button = findLoadMoreButton();

      // ---------------------------------------------------------
      // BUTTON NOT FOUND
      // ---------------------------------------------------------

      if (!button) {
        log('■ Botón no encontrado. Fin normal.');
        break;
      }

      // ---------------------------------------------------------
      // SNAPSHOT BEFORE CLICK
      // ---------------------------------------------------------

      const before = getSnapshot();

      if (!before) {
        log('■ No se pudo analizar el contenido de la página.');
        break;
      }

      // ---------------------------------------------------------
      // CLICK INTERVAL
      // ---------------------------------------------------------

      if (lastClickTime !== null) {
        const timeSinceLastClick =
          performance.now() - lastClickTime;

        const remaining =
          CONFIG.clickDelay - timeSinceLastClick;

        if (remaining > 0) {
          await wait(remaining);
        }
      }

      // Volvemos a buscarlo por si la página cambió durante la espera.
      const currentButton = findLoadMoreButton();

      if (!currentButton) {
        log('■ El botón desapareció durante la espera.');
        break;
      }

      // ---------------------------------------------------------
      // CLICK
      // ---------------------------------------------------------

      const clickStart = performance.now();

      simulateClick(currentButton);

      clicks++;
      lastClickTime = performance.now();

      log(
        `✓ Clic #${clicks} | ` +
        `+${elapsed()}s desde inicio`
      );

      // ---------------------------------------------------------
      // WAIT FOR REAL CONTENT CHANGE
      // ---------------------------------------------------------

      log(
        `↳ Esperando nuevos elementos...`
      );

      const changed =
        await waitForContentChange(before);

      const loadTime =
        ((performance.now() - clickStart) / 1000)
          .toFixed(3);

      if (!changed) {
        log(
          `■ TIMEOUT | No se detectaron cambios ` +
          `después de ${loadTime}s.`
        );

        log('■ Proceso detenido por seguridad.');
        break;
      }

      log(
        `✓ Contenido actualizado | ` +
        `Carga: ${loadTime}s`
      );

      // ---------------------------------------------------------
      // SMALL SAFETY DELAY
      // ---------------------------------------------------------

      await wait(CONFIG.clickDelay);
    }

    // ───────────────────────────────────────────────────────────
    // FINAL STATUS
    // ───────────────────────────────────────────────────────────

    const totalTime =
      ((performance.now() - startTime) / 1000)
        .toFixed(3);

    log('────────────────────────────────────');
    log(`Proceso terminado.`);
    log(`Clics realizados: ${clicks}`);
    log(`Tiempo total: ${totalTime}s`);

    if (clicks >= CONFIG.maxClicks) {
      log(
        `■ Se alcanzó el límite de ${CONFIG.maxClicks} clics.`
      );
    }

    log('────────────────────────────────────');

  } catch (error) {

    // ───────────────────────────────────────────────────────────
    // EMERGENCY STOP
    // ───────────────────────────────────────────────────────────

    console.error(error);

    log(
      `■ ERROR: ${error.message}`
    );

    log(
      `■ Proceso detenido inmediatamente.`
    );
  }
})();
```
