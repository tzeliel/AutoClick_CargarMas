/*
 * ============================================================
 * PAGEUNROLLER X
 * ============================================================
 *
 * Browser console utility for loading paginated / "Load more"
 * content.
 *
 * Modes:
 *
 *   AUTO      Detect the best available method
 *   DOM       Inspect already loaded DOM content
 *   CLICK     Automate "Load more"
 *   NETWORK   Monitor fetch / XHR
 *   DIRECT    Experimental direct pagination analysis
 *
 * Console controls:
 *
 *   PageUnrollerX.status()
 *   PageUnrollerX.pause()
 *   PageUnrollerX.resume()
 *   PageUnrollerX.stop()
 *   PageUnrollerX.network()
 *   PageUnrollerX.config()
 *
 * ============================================================
 */

(async () => {
  'use strict';

  /* ============================================================
     CONFIG
     ============================================================ */

  const CONFIG = {

    mode: 'AUTO',

    buttonTexts: [
      'Cargar más',
      'Cargar mas',
      'Load more',
      'Show more',
      'Ver más',
      'Ver mas',
      'Mostrar más',
      'Mostrar mas'
    ],

    buttonSelectors: [
      'button',
      '[role="button"]',
      'a',
      'input[type="button"]',
      'input[type="submit"]'
    ],

    /*
     * null = whole document
     *
     * Example:
     *
     * '.results'
     * '#results'
     * '[data-testid="results"]'
     */
    containerSelector: null,

    /*
     * Timing
     */

    clickDelay: 750,

    pollInterval: 200,

    stabilityTime: 600,

    loadTimeout: 20_000,

    maxRuntime: 30 * 60 * 1000,

    /*
     * Safety
     */

    maxClicks: 1_000,

    maxUnchangedLoads: 2,

    /*
     * Network monitoring
     */

    monitorFetch: true,

    monitorXHR: true,

    maxNetworkEntries: 500,

    /*
     * Behaviour
     */

    autoScrollToButton: true,

    waitForBusyState: true,

    /*
     * Logging
     */

    verbose: true
  };

  /* ============================================================
     STATE
     ============================================================ */

  const state = {

    running: true,

    paused: false,

    startedAt: performance.now(),

    clicks: 0,

    loads: 0,

    unchangedLoads: 0,

    totalAdded: 0,

    lastAction: null,

    lastLoadTime: null,

    lastChange: null,

    stopReason: null,

    mode: 'UNKNOWN',

    network: {
      fetch: [],
      xhr: []
    },

    observer: null,

    originalFetch: null,

    originalXHROpen: null,

    originalXHRSend: null,

    xhrPatched: false,

    fetchPatched: false
  };

  /* ============================================================
     PUBLIC API
     ============================================================ */

  window.PageUnrollerX = {

    stop(reason = 'Detenido manualmente') {

      state.running = false;
      state.stopReason = reason;

      log(`■ ${reason}`);

      cleanup();
    },

    pause() {

      if (!state.running) {
        return;
      }

      state.paused = true;

      log('⏸ Pausado');
    },

    resume() {

      if (!state.running) {
        return;
      }

      state.paused = false;

      log('▶ Reanudado');
    },

    status() {

      return {
        running: state.running,
        paused: state.paused,
        mode: state.mode,
        clicks: state.clicks,
        loads: state.loads,
        totalAdded: state.totalAdded,
        unchangedLoads: state.unchangedLoads,
        elapsed: elapsed(),
        lastLoadTime: state.lastLoadTime,
        stopReason: state.stopReason,
        network: {
          fetch: state.network.fetch.length,
          xhr: state.network.xhr.length
        }
      };
    },

    network() {

      return {
        fetch: [...state.network.fetch],
        xhr: [...state.network.xhr]
      };
    },

    config() {

      return structuredClone(CONFIG);
    }
  };

  /* ============================================================
     BASIC UTILS
     ============================================================ */

  function wait(ms) {

    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  function elapsed() {

    return (
      (performance.now() - state.startedAt) /
      1000
    ).toFixed(3);
  }

  function timestamp() {

    return new Date().toLocaleTimeString(
      'es-ES',
      {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      }
    );
  }

  function log(message) {

    console.log(
      `[${timestamp()}] ${message}`
    );
  }

  function warn(message) {

    console.warn(
      `[${timestamp()}] ⚠ ${message}`
    );
  }

  function error(message) {

    console.error(
      `[${timestamp()}] ✕ ${message}`
    );
  }

  function normalize(value) {

    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /* ============================================================
     CONTAINER
     ============================================================ */

  function getContainer() {

    if (CONFIG.containerSelector) {

      const selected =
        document.querySelector(
          CONFIG.containerSelector
        );

      if (selected) {
        return selected;
      }
    }

    return document.body;
  }

  /* ============================================================
     DOM SNAPSHOT
     ============================================================ */

  function snapshot() {

    const container =
      getContainer();

    return {

      children:
        container.children.length,

      text:
        container.innerText?.length || 0,

      html:
        container.innerHTML?.length || 0,

      height:
        container.scrollHeight,

      links:
        container.querySelectorAll('a').length,

      images:
        container.querySelectorAll('img').length
    };
  }

  function hasChanged(before, after) {

    return (

      before.children !==
      after.children ||

      before.text !==
      after.text ||

      before.html !==
      after.html ||

      before.height !==
      after.height ||

      before.links !==
      after.links ||

      before.images !==
      after.images
    );
  }

  function getGrowth(before, after) {

    return {

      children:
        after.children -
        before.children,

      text:
        after.text -
        before.text,

      height:
        after.height -
        before.height,

      links:
        after.links -
        before.links,

      images:
        after.images -
        before.images
    };
  }

  /* ============================================================
     VISIBILITY
     ============================================================ */

  function isVisible(element) {

    if (
      !element ||
      !element.isConnected
    ) {
      return false;
    }

    const style =
      window.getComputedStyle(element);

    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    ) {
      return false;
    }

    const rect =
      element.getBoundingClientRect();

    return (
      rect.width > 0 &&
      rect.height > 0
    );
  }

  /* ============================================================
     BUTTON DETECTION
     ============================================================ */

  function matchesButtonText(text) {

    const value =
      normalize(text);

    return CONFIG.buttonTexts.some(
      candidate =>
        value === normalize(candidate)
    );
  }

  function findLoadMoreButton() {

    const elements =
      document.querySelectorAll(
        CONFIG.buttonSelectors.join(',')
      );

    const candidates = [];

    for (const element of elements) {

      if (!isVisible(element)) {
        continue;
      }

      const values = [

        element.innerText,

        element.textContent,

        element.getAttribute(
          'aria-label'
        ),

        element.getAttribute(
          'title'
        ),

        element.getAttribute(
          'value'
        )
      ];

      if (
        values.some(
          matchesButtonText
        )
      ) {

        candidates.push(element);
      }
    }

    if (!candidates.length) {
      return null;
    }

    /*
     * Prefer the lowest visible candidate.
     */

    candidates.sort(
      (a, b) => {

        const ar =
          a.getBoundingClientRect();

        const br =
          b.getBoundingClientRect();

        return br.top - ar.top;
      }
    );

    return candidates[0];
  }

  /* ============================================================
     BUSY / LOADING DETECTION
     ============================================================ */

  function pageLooksBusy() {

    const selectors = [

      '[aria-busy="true"]',

      '[role="progressbar"]',

      '[class*="loading" i]',

      '[class*="loader" i]',

      '[class*="spinner" i]',

      '[aria-label*="loading" i]',

      '[aria-label*="cargando" i]'
    ];

    for (const selector of selectors) {

      const elements =
        document.querySelectorAll(
          selector
        );

      for (const element of elements) {

        if (isVisible(element)) {
          return true;
        }
      }
    }

    return false;
  }

  function buttonLooksBusy(button) {

    if (!button) {
      return true;
    }

    const text =
      normalize(
        button.innerText ||
        button.textContent
      );

    return (

      button.disabled ||

      button.getAttribute(
        'aria-disabled'
      ) === 'true' ||

      button.getAttribute(
        'aria-busy'
      ) === 'true' ||

      text.includes('loading') ||

      text.includes('cargando')
    );
  }

  /* ============================================================
     MUTATION OBSERVER
     ============================================================ */

  function startObserver() {

    const container =
      getContainer();

    state.observer =
      new MutationObserver(() => {

        state.lastChange =
          performance.now();
      });

    state.observer.observe(
      container,
      {
        childList: true,
        subtree: true,
        characterData: true
      }
    );
  }

  /* ============================================================
     FETCH MONITOR
     ============================================================ */

  function startFetchMonitor() {

    if (
      !CONFIG.monitorFetch ||
      typeof window.fetch !== 'function'
    ) {
      return;
    }

    if (state.fetchPatched) {
      return;
    }

    state.originalFetch =
      window.fetch;

    window.fetch =
      async function (...args) {

        const started =
          performance.now();

        let url = '';

        let method = 'GET';

        try {

          const input =
            args[0];

          const options =
            args[1];

          url =
            typeof input === 'string'
              ? input
              : input?.url || '';

          method =
            options?.method ||
            input?.method ||
            'GET';

        } catch {}

        let response;

        try {

          response =
            await state.originalFetch.apply(
              this,
              args
            );

        } catch (err) {

          recordFetch({
            url,
            method,
            status: 'ERROR',
            duration:
              performance.now() -
              started,
            error:
              err?.message || String(err)
          });

          throw err;
        }

        recordFetch({
          url,
          method,
          status: response.status,
          duration:
            performance.now() -
            started
        });

        return response;
      };

    state.fetchPatched = true;

    log('✓ Monitorización fetch activa');
  }

  function recordFetch(data) {

    state.network.fetch.push({

      ...data,

      time:
        timestamp()
    });

    if (
      state.network.fetch.length >
      CONFIG.maxNetworkEntries
    ) {

      state.network.fetch.shift();
    }
  }

  /* ============================================================
     XHR MONITOR
     ============================================================ */

  function startXHRMonitor() {

    if (
      !CONFIG.monitorXHR ||
      !window.XMLHttpRequest
    ) {
      return;
    }

    if (state.xhrPatched) {
      return;
    }

    const prototype =
      XMLHttpRequest.prototype;

    state.originalXHROpen =
      prototype.open;

    state.originalXHRSend =
      prototype.send;

    prototype.open =
      function (
        method,
        url,
        ...rest
      ) {

        this.__pageUnroller =
          {
            method:
              method || 'GET',

            url:
              String(url || ''),

            started:
              null
          };

        return state.originalXHROpen.call(
          this,
          method,
          url,
          ...rest
        );
      };

    prototype.send =
      function (...args) {

        const meta =
          this.__pageUnroller;

        if (meta) {

          meta.started =
            performance.now();

          this.addEventListener(
            'loadend',
            () => {

              state.network.xhr.push({

                url:
                  meta.url,

                method:
                  meta.method,

                status:
                  this.status,

                duration:
                  performance.now() -
                  meta.started,

                time:
                  timestamp()
              });

              if (
                state.network.xhr.length >
                CONFIG.maxNetworkEntries
              ) {

                state.network.xhr.shift();
              }
            },
            {
              once: true
            }
          );
        }

        return state.originalXHRSend.apply(
          this,
          args
        );
      };

    state.xhrPatched = true;

    log('✓ Monitorización XHR activa');
  }

  /* ============================================================
     NETWORK ANALYSIS
     ============================================================ */

  function getNetworkRequests() {

    return [

      ...state.network.fetch.map(
        item => ({
          ...item,
          type: 'fetch'
        })
      ),

      ...state.network.xhr.map(
        item => ({
          ...item,
          type: 'xhr'
        })
      )
    ];
  }

  function analyseNetwork() {

    const requests =
      getNetworkRequests();

    const groups =
      new Map();

    for (const request of requests) {

      if (!request.url) {
        continue;
      }

      try {

        const url =
          new URL(
            request.url,
            location.href
          );

        const key =
          `${request.method} ${url.origin}${url.pathname}`;

        if (!groups.has(key)) {

          groups.set(
            key,
            []
          );
        }

        groups
          .get(key)
          .push(request);

      } catch {}
    }

    return [...groups.entries()]
      .map(
        ([endpoint, entries]) => ({

          endpoint,

          count:
            entries.length,

          requests:
            entries
        })
      )
      .sort(
        (a, b) =>
          b.count - a.count
      );
  }

  /* ============================================================
     PAGINATION PARAMETER ANALYSIS
     ============================================================ */

  function analysePagination(urlString) {

    try {

      const url =
        new URL(
          urlString,
          location.href
        );

      const params =
        [...url.searchParams.entries()];

      const candidates = [

        'page',

        'p',

        'offset',

        'skip',

        'start',

        'cursor',

        'after',

        'before',

        'limit',

        'size',

        'pageSize',

        'perPage'
      ];

      const found = [];

      for (const [
        key,
        value
      ] of params) {

        if (
          candidates.includes(
            key.toLowerCase()
          )
        ) {

          found.push({
            key,
            value
          });
        }
      }

      return {

        url:
          url.href,

        parameters:
          found
      };

    } catch {

      return null;
    }
  }

  /* ============================================================
     NETWORK REPORT
     ============================================================ */

  function printNetworkAnalysis() {

    const groups =
      analyseNetwork();

    if (!groups.length) {

      log(
        'No se han observado peticiones fetch/XHR.'
      );

      return;
    }

    console.group(
      '[PageUnroller X] Network'
    );

    for (const group of groups) {

      console.log(
        `${group.count}x ${group.endpoint}`
      );

      const latest =
        group.requests[
          group.requests.length - 1
        ];

      const pagination =
        analysePagination(
          latest.url
        );

      if (
        pagination?.parameters?.length
      ) {

        console.log(
          'Parámetros de paginación:',
          pagination.parameters
        );
      }
    }

    console.groupEnd();
  }

  /* ============================================================
     DOM ANALYSIS
     ============================================================ */

  function analyseDOM() {

    const current =
      snapshot();

    const button =
      findLoadMoreButton();

    const paginationLinks =
      [...document.querySelectorAll(
        'a'
      )]
        .filter(isVisible)
        .filter(
          link =>
            /page|next|siguiente|más|mas/i
              .test(
                link.innerText ||
                link.textContent ||
                ''
              )
        );

    return {

      elements:
        current.children,

      textLength:
        current.text,

      height:
        current.height,

      loadMoreButton:
        !!button,

      paginationLinks:
        paginationLinks.length
    };
  }

  /* ============================================================
     MODE DETECTION
     ============================================================ */

  function detectMode() {

    const dom =
      analyseDOM();

    if (
      dom.loadMoreButton
    ) {

      return 'CLICK';
    }

    if (
      dom.paginationLinks > 0
    ) {

      return 'PAGINATION';
    }

    return 'DOM';
  }

  /* ============================================================
     SCROLL
     ============================================================ */

  function scrollToButton(button) {

    if (
      !CONFIG.autoScrollToButton
    ) {
      return;
    }

    try {

      button.scrollIntoView({
        behavior: 'auto',
        block: 'center'
      });

    } catch {}
  }

  /* ============================================================
     CLICK
     ============================================================ */

  function clickButton(button) {

    if (
      !button ||
      !isVisible(button) ||
      buttonLooksBusy(button)
    ) {

      return false;
    }

    scrollToButton(button);

    /*
     * Native click first.
     */

    try {

      button.click();

      return true;

    } catch {}

    /*
     * Mouse-event fallback.
     */

    try {

      const rect =
        button.getBoundingClientRect();

      const options = {

        bubbles: true,

        cancelable: true,

        view: window,

        clientX:
          rect.left +
          rect.width / 2,

        clientY:
          rect.top +
          rect.height / 2,

        button: 0
      };

      for (
        const eventName of [
          'mousedown',
          'mouseup',
          'click'
        ]
      ) {

        button.dispatchEvent(
          new MouseEvent(
            eventName,
            options
          )
        );
      }

      return true;

    } catch {

      return false;
    }
  }

  /* ============================================================
     WAIT FOR CONTENT
     ============================================================ */

  async function waitForContent(before) {

    const started =
      performance.now();

    let detectedChange =
      false;

    let stableSince = null;

    let previous =
      before;

    while (state.running) {

      while (state.paused) {

        await wait(250);
      }

      if (
        performance.now() -
        started >=
        CONFIG.loadTimeout
      ) {

        return {

          success: false,

          reason:
            'Timeout esperando contenido'
        };
      }

      await wait(
        CONFIG.pollInterval
      );

      const current =
        snapshot();

      if (
        hasChanged(
          before,
          current
        )
      ) {

        detectedChange = true;
      }

      if (detectedChange) {

        if (
          current.html !==
          previous.html
        ) {

          stableSince =
            performance.now();
        }

        if (!stableSince) {

          stableSince =
            performance.now();
        }

        const stableFor =
          performance.now() -
          stableSince;

        if (
          stableFor >=
          CONFIG.stabilityTime
        ) {

          if (
            !CONFIG.waitForBusyState ||
            !pageLooksBusy()
          ) {

            return {

              success: true,

              snapshot: current,

              elapsed:
                performance.now() -
                started
            };
          }
        }
      }

      previous =
        current;
    }

    return {

      success: false,

      reason:
        'Proceso detenido'
    };
  }

  /* ============================================================
     CLICK MODE
     ============================================================ */

  async function runClickMode() {

    state.mode = 'CLICK';

    log(
      'Modo CLICK seleccionado'
    );

    while (state.running) {

      while (state.paused) {

        await wait(250);
      }

      /*
       * Runtime limit.
       */

      if (
        performance.now() -
        state.startedAt >=
        CONFIG.maxRuntime
      ) {

        state.stopReason =
          'Tiempo máximo alcanzado';

        break;
      }

      /*
       * Click limit.
       */

      if (
        state.clicks >=
        CONFIG.maxClicks
      ) {

        state.stopReason =
          'Límite máximo de clics alcanzado';

        break;
      }

      /*
       * Wait for current load.
       */

      if (
        CONFIG.waitForBusyState &&
        pageLooksBusy()
      ) {

        await wait(
          CONFIG.pollInterval
        );

        continue;
      }

      const button =
        findLoadMoreButton();

      if (!button) {

        state.stopReason =
          'No se encontró más contenido';

        log(
          '■ No hay más botones de carga.'
        );

        break;
      }

      /*
       * Delay.
       */

      if (state.lastAction) {

        const since =
          performance.now() -
          state.lastAction;

        if (
          since <
          CONFIG.clickDelay
        ) {

          await wait(
            CONFIG.clickDelay -
            since
          );
        }
      }

      /*
       * Revalidate.
       */

      const currentButton =
        findLoadMoreButton();

      if (!currentButton) {
        continue;
      }

      if (
        buttonLooksBusy(
          currentButton
        )
      ) {

        await wait(
          CONFIG.pollInterval
        );

        continue;
      }

      /*
       * Snapshot.
       */

      const before =
        snapshot();

      /*
       * Click.
       */

      if (
        !clickButton(
          currentButton
        )
      ) {

        state.stopReason =
          'No se pudo pulsar el botón';

        error(
          'No se pudo interactuar con el botón.'
        );

        break;
      }

      state.clicks++;

      state.lastAction =
        performance.now();

      log(
        `✓ Clic #${state.clicks}`
      );

      /*
       * Wait for real content.
       */

      const result =
        await waitForContent(
          before
        );

      if (!result.success) {

        state.unchangedLoads++;

        warn(
          result.reason
        );

        if (
          state.unchangedLoads >=
          CONFIG.maxUnchangedLoads
        ) {

          state.stopReason =
            'No se detectaron nuevos contenidos';

          break;
        }

        continue;
      }

      /*
       * Success.
       */

      state.loads++;

      state.unchangedLoads = 0;

      state.lastLoadTime =
        result.elapsed;

      const after =
        result.snapshot;

      const added =
        getGrowth(
          before,
          after
        );

      state.totalAdded +=
        Math.max(
          0,
          added.children
        );

      log(
        `✓ Carga #${state.loads} | ` +
        `${(
          result.elapsed / 1000
        ).toFixed(3)}s | ` +
        `+${added.children} elementos`
      );

      await wait(
        CONFIG.clickDelay
      );
    }
  }

  /* ============================================================
     PAGINATION MODE
     ============================================================ */

  async function runPaginationMode() {

    state.mode =
      'PAGINATION';

    log(
      'Modo PAGINATION detectado'
    );

    /*
     * We deliberately do not blindly rewrite
     * URLs or submit arbitrary requests.
     *
     * First locate a visible "next" control.
     */

    const nextPatterns = [

      /^next$/i,

      /^siguiente$/i,

      /^›$/,

      /^>$/,

      /^→$/,

      /next page/i,

      /página siguiente/i,

      /pagina siguiente/i
    ];

    while (state.running) {

      while (state.paused) {

        await wait(250);
      }

      const links =
        [...document.querySelectorAll(
          'a, button, [role="button"]'
        )]
          .filter(isVisible)
          .filter(element => {

            const text =
              normalize(
                element.innerText ||
                element.textContent
              );

            const aria =
              normalize(
                element.getAttribute(
                  'aria-label'
                )
              );

            return nextPatterns.some(
              pattern =>
                pattern.test(text) ||
                pattern.test(aria)
            );
          });

      if (!links.length) {

        state.stopReason =
          'No se encontró siguiente página';

        break;
      }

      const next =
        links[0];

      const before =
        snapshot();

      if (
        !clickButton(next)
      ) {

        state.stopReason =
          'No se pudo avanzar de página';

        break;
      }

      state.clicks++;

      log(
        `✓ Página siguiente | acción #${state.clicks}`
      );

      const result =
        await waitForContent(
          before
        );

      if (!result.success) {

        state.stopReason =
          result.reason;

        break;
      }

      state.loads++;

      const after =
        result.snapshot;

      const added =
        getGrowth(
          before,
          after
        );

      state.totalAdded +=
        Math.max(
          0,
          added.children
        );

      log(
        `✓ Página cargada | +${added.children} elementos`
      );
    }
  }

  /* ============================================================
     DOM MODE
     ============================================================ */

  async function runDOMMode() {

    state.mode = 'DOM';

    log(
      'Modo DOM seleccionado'
    );

    const before =
      snapshot();

    /*
     * No hacemos modificaciones destructivas.
     *
     * Simplemente mostramos información sobre
     * el contenido que ya existe.
     */

    log(
      `Elementos actuales: ${before.children}`
    );

    log(
      `Altura del contenido: ${before.height}px`
    );

    state.stopReason =
      'Contenido DOM analizado';
  }

  /* ============================================================
     CLEANUP
     ============================================================ */

  function cleanup() {

    if (state.observer) {

      state.observer.disconnect();

      state.observer = null;
    }

    /*
     * Restore fetch.
     */

    if (
      state.fetchPatched &&
      state.originalFetch
    ) {

      window.fetch =
        state.originalFetch;
    }

    /*
     * Restore XHR.
     */

    if (
      state.xhrPatched &&
      state.originalXHROpen
    ) {

      XMLHttpRequest.prototype.open =
        state.originalXHROpen;
    }

    if (
      state.xhrPatched &&
      state.originalXHRSend
    ) {

      XMLHttpRequest.prototype.send =
        state.originalXHRSend;
    }

    state.fetchPatched = false;

    state.xhrPatched = false;
  }

  /* ============================================================
     FINAL REPORT
     ============================================================ */

  function report() {

    const total =
      (
        performance.now() -
        state.startedAt
      ) / 1000;

    console.log('');

    console.log(
      '══════════════════════════════════════'
    );

    console.log(
      '          PAGEUNROLLER X'
    );

    console.log(
      '══════════════════════════════════════'
    );

    console.log(
      `Modo: ${state.mode}`
    );

    console.log(
      `Clics: ${state.clicks}`
    );

    console.log(
      `Cargas: ${state.loads}`
    );

    console.log(
      `Elementos añadidos: ${state.totalAdded}`
    );

    console.log(
      `Tiempo total: ${total.toFixed(3)}s`
    );

    console.log(
      `Fetch observados: ${state.network.fetch.length}`
    );

    console.log(
      `XHR observados: ${state.network.xhr.length}`
    );

    console.log(
      `Motivo: ${state.stopReason || 'Finalizado'}`
    );

    console.log(
      '══════════════════════════════════════'
    );

    printNetworkAnalysis();
  }

  /* ============================================================
     MAIN
     ============================================================ */

  log(
    '▶ PageUnroller X iniciado'
  );

  log(
    'Analizando página...'
  );

  /*
   * Start instrumentation before interacting.
   */

  startFetchMonitor();

  startXHRMonitor();

  startObserver();

  /*
   * Initial DOM analysis.
   */

  const initial =
    analyseDOM();

  log(
    `DOM: ${initial.elements} elementos`
  );

  if (
    initial.loadMoreButton
  ) {

    log(
      '✓ Botón "Cargar más" detectado'
    );
  }

  if (
    initial.paginationLinks
  ) {

    log(
      `✓ Posibles controles de paginación: ${
        initial.paginationLinks
      }`
    );
  }

  /*
   * Network observation needs a real interaction
   * to become useful, so AUTO starts with the safest
   * available UI mechanism.
   */

  let selectedMode =
    CONFIG.mode;

  if (
    selectedMode === 'AUTO'
  ) {

    selectedMode =
      detectMode();

    log(
      `Modo seleccionado: ${selectedMode}`
    );
  }

  try {

    switch (selectedMode) {

      case 'CLICK':

        await runClickMode();

        break;

      case 'PAGINATION':

        await runPaginationMode();

        break;

      case 'DOM':

        await runDOMMode();

        break;

      case 'NETWORK':

        state.mode =
          'NETWORK';

        log(
          'Modo NETWORK: observando peticiones.'
        );

        /*
         * Network mode intentionally does not
         * generate requests by itself.
         *
         * Use the page normally and inspect:
         *
         * PageUnrollerX.network()
         */

        while (
          state.running
        ) {

          await wait(500);
        }

        break;

      default:

        state.stopReason =
          `Modo desconocido: ${selectedMode}`;
    }

  } catch (err) {

    state.stopReason =
      'Error inesperado';

    error(
      err?.message ||
      String(err)
    );

  } finally {

    state.running = false;

    cleanup();

    if (!state.stopReason) {

      state.stopReason =
        'Finalizado';
    }

    report();
  }

})();
