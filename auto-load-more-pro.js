(async () => {
  'use strict';

  /* =========================================================
     AUTO CLICK PRO
     Automatiza botones "Cargar más" y similares.

     Detener desde consola:
       window.AutoClickPro.stop()

     Estado:
       window.AutoClickPro.status()
  ========================================================= */

  const CONFIG = {
    // Texto que puede tener el botón.
    buttonTexts: [
      'Cargar más',
      'Cargar mas',
      'Load more',
      'Ver más',
      'Ver mas',
      'Mostrar más',
      'Mostrar mas'
    ],

    // Selectores adicionales que pueden ayudar a localizarlo.
    buttonSelectors: [
      'button',
      '[role="button"]',
      'a',
      'input[type="button"]',
      'input[type="submit"]'
    ],

    // Selector opcional del contenedor que contiene los resultados.
    // null = analizar la página completa.
    containerSelector: null,

    // Espera mínima entre clics.
    clickDelay: 1000,

    // Tiempo máximo esperando que una carga termine.
    loadTimeout: 20000,

    // Tiempo máximo de ejecución completa.
    maxRuntime: 30 * 60 * 1000,

    // Número máximo de clics.
    maxClicks: 500,

    // Frecuencia de comprobación.
    pollInterval: 250,

    // Número de cargas consecutivas sin crecimiento antes de parar.
    maxUnchangedLoads: 2,

    // Tiempo que debe permanecer estable el contenido
    // para considerar que una carga ha terminado.
    stabilityTime: 750,

    // Intentar estos métodos de interacción.
    useNativeClick: true,
    useMouseEvents: true,

    // Mostrar información detallada.
    verbose: true
  };

  /* =========================================================
     ESTADO
  ========================================================= */

  const state = {
    running: true,
    clicks: 0,
    startTime: performance.now(),
    lastClickTime: null,
    lastChangeTime: null,
    lastLoadTime: null,
    unchangedLoads: 0,
    totalAdded: 0,
    observer: null,
    stopReason: null,
    loadTimes: []
  };

  /* =========================================================
     CONTROL GLOBAL
  ========================================================= */

  window.AutoClickPro = {
    stop(reason = 'Detenido manualmente') {
      state.running = false;
      state.stopReason = reason;

      if (state.observer) {
        state.observer.disconnect();
      }

      console.warn(`[AutoClick Pro] ■ ${reason}`);
    },

    status() {
      return {
        running: state.running,
        clicks: state.clicks,
        elapsed: getElapsed(),
        unchangedLoads: state.unchangedLoads,
        totalAdded: state.totalAdded,
        lastLoadTime: state.lastLoadTime,
        stopReason: state.stopReason
      };
    }
  };

  /* =========================================================
     UTILIDADES
  ========================================================= */

  const wait = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  function getElapsed() {
    return ((performance.now() - state.startTime) / 1000).toFixed(3);
  }

  function timestamp() {
    return new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  }

  function log(message) {
    console.log(`[${timestamp()}] ${message}`);
  }

  function warn(message) {
    console.warn(`[${timestamp()}] ${message}`);
  }

  function error(message) {
    console.error(`[${timestamp()}] ${message}`);
  }

  function getContainer() {
    if (!CONFIG.containerSelector) {
      return document.body;
    }

    return document.querySelector(CONFIG.containerSelector)
      || document.body;
  }

  /* =========================================================
     VISIBILIDAD
     ========================================================= */

  function isVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    const style = window.getComputedStyle(element);

    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    ) {
      return false;
    }

    if (
      element.disabled ||
      element.getAttribute('aria-disabled') === 'true'
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      element.offsetParent !== null
    );
  }

  /* =========================================================
     TEXTO DEL ELEMENTO
     ========================================================= */

  function normalizeText(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function isLoadMoreText(text) {
    const normalized = normalizeText(text);

    return CONFIG.buttonTexts.some(
      candidate =>
        normalized === normalizeText(candidate)
    );
  }

  /* =========================================================
     DETECCIÓN DEL BOTÓN
     ========================================================= */

  function findLoadMoreButton() {
    const elements = document.querySelectorAll(
      CONFIG.buttonSelectors.join(',')
    );

    const candidates = [];

    for (const element of elements) {
      if (!isVisible(element)) {
        continue;
      }

      const text = element.innerText?.trim();
      const aria = element.getAttribute('aria-label');
      const title = element.getAttribute('title');
      const value = element.getAttribute('value');

      if (
        isLoadMoreText(text) ||
        isLoadMoreText(aria) ||
        isLoadMoreText(title) ||
        isLoadMoreText(value)
      ) {
        candidates.push(element);
      }
    }

    if (!candidates.length) {
      return null;
    }

    /*
      Si hay varios botones, preferimos el que esté
      más abajo en la página.
    */

    candidates.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();

      return bRect.top - aRect.top;
    });

    return candidates[0];
  }

  /* =========================================================
     SNAPSHOT DEL CONTENIDO
     ========================================================= */

  function getSnapshot() {
    const container = getContainer();

    return {
      childCount: container.children.length,
      textLength: container.innerText?.length || 0,
      htmlLength: container.innerHTML?.length || 0,
      scrollHeight: container.scrollHeight
    };
  }

  function getGrowth(before, after) {
    return {
      children:
        after.childCount - before.childCount,

      text:
        after.textLength - before.textLength,

      html:
        after.htmlLength - before.htmlLength,

      scroll:
        after.scrollHeight - before.scrollHeight
    };
  }

  function hasChanged(before, after) {
    return (
      after.childCount !== before.childCount ||
      after.textLength !== before.textLength ||
      after.htmlLength !== before.htmlLength ||
      after.scrollHeight !== before.scrollHeight
    );
  }

  /* =========================================================
     ESTADOS DE CARGA
     ========================================================= */

  function pageLooksBusy() {
    const selectors = [
      '[aria-busy="true"]',
      '[aria-label*="loading" i]',
      '[aria-label*="cargando" i]',
      '.loading',
      '.loader',
      '.spinner',
      '[class*="loading" i]',
      '[class*="spinner" i]'
    ];

    return selectors.some(selector => {
      return [...document.querySelectorAll(selector)]
        .some(isVisible);
    });
  }

  function buttonLooksBusy(button) {
    if (!button) {
      return false;
    }

    const text = normalizeText(
      button.innerText ||
      button.textContent ||
      ''
    );

    const ariaBusy =
      button.getAttribute('aria-busy') === 'true';

    const disabled =
      button.disabled ||
      button.getAttribute('aria-disabled') === 'true';

    const loadingWords = [
      'loading',
      'cargando',
      'cargando...',
      'loading...'
    ];

    return (
      ariaBusy ||
      disabled ||
      loadingWords.some(word =>
        text.includes(word)
      )
    );
  }

  /* =========================================================
     OBSERVER
     ========================================================= */

  function createObserver() {
    const container = getContainer();

    if (state.observer) {
      state.observer.disconnect();
    }

    state.observer = new MutationObserver(() => {
      state.lastChangeTime = performance.now();
    });

    state.observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: false
    });
  }

  /* =========================================================
     ESPERAR A QUE TERMINE UNA CARGA
     ========================================================= */

  async function waitForLoad(beforeSnapshot) {
    const started = performance.now();

    let changed = false;
    let lastSnapshot = beforeSnapshot;
    let stableSince = null;

    while (state.running) {
      const elapsed =
        performance.now() - started;

      if (elapsed >= CONFIG.loadTimeout) {
        return {
          success: false,
          reason: 'Timeout esperando contenido'
        };
      }

      await wait(CONFIG.pollInterval);

      const currentSnapshot = getSnapshot();

      if (hasChanged(
        beforeSnapshot,
        currentSnapshot
      )) {
        changed = true;
      }

      if (changed) {
        if (
          lastSnapshot.htmlLength !==
          currentSnapshot.htmlLength
        ) {
          stableSince = performance.now();
        }

        if (!stableSince) {
          stableSince = performance.now();
        }

        const stableFor =
          performance.now() - stableSince;

        /*
          Esperamos un poco después del último cambio
          para evitar empezar otro clic mientras la página
          todavía está construyendo contenido.
        */

        if (
          stableFor >= CONFIG.stabilityTime &&
          !pageLooksBusy()
        ) {
          return {
            success: true,
            snapshot: currentSnapshot,
            elapsed:
              performance.now() - started
          };
        }
      }

      lastSnapshot = currentSnapshot;
    }

    return {
      success: false,
      reason: 'Proceso detenido'
    };
  }

  /* =========================================================
     CLIC NATIVO
     ========================================================= */

  function nativeClick(button) {
    if (!CONFIG.useNativeClick) {
      return false;
    }

    try {
      button.click();
      return true;
    } catch {
      return false;
    }
  }

  /* =========================================================
     CLIC MEDIANTE EVENTOS
     ========================================================= */

  function mouseClick(button) {
    if (!CONFIG.useMouseEvents) {
      return false;
    }

    try {
      const rect =
        button.getBoundingClientRect();

      const clientX =
        rect.left + rect.width / 2;

      const clientY =
        rect.top + rect.height / 2;

      const events = [
        'mousedown',
        'mouseup',
        'click'
      ];

      for (const type of events) {
        button.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX,
            clientY,
            button: 0
          })
        );
      }

      return true;
    } catch {
      return false;
    }
  }

  /* =========================================================
     CLIC
     ========================================================= */

  function clickButton(button) {
    if (!button || !isVisible(button)) {
      return false;
    }

    if (buttonLooksBusy(button)) {
      return false;
    }

    /*
      Primero intentamos el click nativo.
      Si falla, usamos la secuencia de eventos.
    */

    if (nativeClick(button)) {
      return true;
    }

    return mouseClick(button);
  }

  /* =========================================================
     ESTADÍSTICAS
     ========================================================= */

  function printStatistics() {
    const totalTime =
      (performance.now() -
        state.startTime) / 1000;

    const loads = state.loadTimes;

    const average =
      loads.length
        ? loads.reduce((a, b) => a + b, 0) /
          loads.length
        : 0;

    console.log('');
    console.log('════════════════════════════════');
    console.log('      AUTO CLICK PRO');
    console.log('════════════════════════════════');
    console.log(`Clics: ${state.clicks}`);
    console.log(`Contenido añadido: ${state.totalAdded}`);
    console.log(
      `Tiempo total: ${totalTime.toFixed(3)}s`
    );
    console.log(
      `Carga media: ${(average / 1000).toFixed(3)}s`
    );
    console.log(
      `Sin cambios consecutivos: ${state.unchangedLoads}`
    );
    console.log(
      `Motivo: ${state.stopReason || 'Finalizado'}`
    );
    console.log('════════════════════════════════');
  }

  /* =========================================================
     EJECUCIÓN
     ========================================================= */

  log('▶ Auto Click Pro iniciado');

  createObserver();

  try {
    while (state.running) {
      /*
        Timeout global.
      */

      if (
        performance.now() -
          state.startTime >=
        CONFIG.maxRuntime
      ) {
        state.stopReason =
          'Tiempo máximo de ejecución alcanzado';

        break;
      }

      /*
        Límite de clics.
      */

      if (state.clicks >= CONFIG.maxClicks) {
        state.stopReason =
          'Límite máximo de clics alcanzado';

        break;
      }

      /*
        Buscar botón.
      */

      const button =
        findLoadMoreButton();

      if (!button) {
        state.stopReason =
          'No se encontró el botón';

        log('■ No encuentro el botón de carga.');

        break;
      }

      /*
        Si la página sigue cargando, esperamos.
      */

      if (pageLooksBusy()) {
        log('… Página ocupada. Esperando.');
        await wait(CONFIG.pollInterval);
        continue;
      }

      /*
        Espera mínima entre clics.
      */

      if (state.lastClickTime) {
        const sinceLastClick =
          performance.now() -
          state.lastClickTime;

        if (
          sinceLastClick <
          CONFIG.clickDelay
        ) {
          await wait(
            CONFIG.clickDelay -
            sinceLastClick
          );
        }
      }

      /*
        Volver a comprobar el botón después
        de la espera.
      */

      const currentButton =
        findLoadMoreButton();

      if (!currentButton) {
        continue;
      }

      if (buttonLooksBusy(currentButton)) {
        await wait(CONFIG.pollInterval);
        continue;
      }

      /*
        Snapshot antes del clic.
      */

      const before =
        getSnapshot();

      /*
        Realizar clic.
      */

      const clicked =
        clickButton(currentButton);

      if (!clicked) {
        state.stopReason =
          'No se pudo hacer clic en el botón';

        error(
          'No se pudo interactuar con el botón.'
        );

        break;
      }

      state.clicks++;
      state.lastClickTime =
        performance.now();

      log(
        `✓ Clic #${state.clicks} | ` +
        `+${getElapsed()}s desde inicio`
      );

      /*
        Esperar a que la página responda.
      */

      const result =
        await waitForLoad(before);

      if (!result.success) {
        state.unchangedLoads++;

        warn(
          `■ ${result.reason}`
        );

        if (
          state.unchangedLoads >=
          CONFIG.maxUnchangedLoads
        ) {
          state.stopReason =
            'No se detectaron nuevos contenidos';

          break;
        }

        await wait(
          CONFIG.clickDelay
        );

        continue;
      }

      /*
        Hemos detectado cambios.
      */

      state.unchangedLoads = 0;

      const after =
        result.snapshot;

      const growth =
        getGrowth(before, after);

      state.totalAdded +=
        Math.max(0, growth.children);

      state.lastLoadTime =
        result.elapsed;

      state.loadTimes.push(
        result.elapsed
      );

      log(
        `✓ Contenido actualizado | ` +
        `Carga: ${(result.elapsed / 1000).toFixed(3)}s | ` +
        `Δ hijos: ${growth.children} | ` +
        `Δ texto: ${growth.text}`
      );

      /*
        Pequeña pausa antes de volver a buscar
        el botón.
      */

      await wait(
        CONFIG.clickDelay
      );
    }
  } catch (err) {
    state.stopReason =
      'Error inesperado';

    error(
      `Error: ${err?.message || err}`
    );
  } finally {
    state.running = false;

    if (state.observer) {
      state.observer.disconnect();
    }

    if (!state.stopReason) {
      state.stopReason =
        'Finalizado';
    }

    printStatistics();
  }
})();
