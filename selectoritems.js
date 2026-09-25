(async () => {

  const OBJETIVOS = [
    "Infraestructura - Test de penetración",
    "Web Apps - Test de penetración",
    "APIs y servicios web - Test de penetración",
    "Análisis y reversión de malware",
    "Investigación y Inteligencia de seguridad e inteligencia de ciberamenazas",
    "Gestión de riesgos de seguridad"
  ];

  const norm = s => (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const objetivos = new Set(OBJETIVOS.map(norm));

  /*
   * Todas las opciones parecen ser elementos:
   * <li class="sapMLIB ... interestListCustomListItem">
   */

  const items = [...document.querySelectorAll(
    "li.sapMLIB.interestListCustomListItem"
  )];

  console.log("Elementos de la lista encontrados:", items.length);

  if (!items.length) {
    console.error("No se han encontrado los elementos SAPUI5 de la lista.");
    return;
  }

  // ------------------------------------------------------------
  // FUNCIÓN PARA OBTENER EL TEXTO PRINCIPAL DE UNA OPCIÓN
  // ------------------------------------------------------------

  function textoItem(item) {
    return norm(item.innerText || item.textContent);
  }

  // ------------------------------------------------------------
  // MOSTRAR INFORMACIÓN DE UNA OPCIÓN
  // ------------------------------------------------------------

  const diagnostico = items.find(item =>
    textoItem(item) === norm(OBJETIVOS[0])
  );

  if (diagnostico) {
    console.log("=== ESTRUCTURA SAPUI5 DETECTADA ===");
    console.log(diagnostico);
    console.log("HTML:", diagnostico.outerHTML);
  }

  // ------------------------------------------------------------
  // INTENTAR DETECTAR QUÉ ELEMENTOS ESTÁN SELECCIONADOS
  // ------------------------------------------------------------

  const clasesSeleccion = [
    "sapMLIBSelected",
    "sapMLIBSelectedAlt",
    "sapMLIBActive",
    "sapMLIBFocusable"
  ];

  const seleccionados = items.filter(item =>
    clasesSeleccion.some(c => item.classList.contains(c)) ||
    item.getAttribute("aria-selected") === "true" ||
    item.getAttribute("aria-checked") === "true"
  );

  console.log(
    "Posibles elementos actualmente seleccionados:",
    seleccionados.length
  );

  seleccionados.forEach(item => {
    console.log(
      "SELECCIONADO:",
      textoItem(item),
      item.className,
      "aria-selected:",
      item.getAttribute("aria-selected"),
      "aria-checked:",
      item.getAttribute("aria-checked")
    );
  });

  // ------------------------------------------------------------
  // FUNCIÓN DE CLICK SAPUI5
  // ------------------------------------------------------------

  async function clickItem(item) {

    item.scrollIntoView({
      behavior: "instant",
      block: "center"
    });

    await new Promise(r => setTimeout(r, 80));

    // Preferimos el elemento que SAPUI5 está tratando como botón
    const boton = item.querySelector(
      ".sapMBtnInner, .sapMBtn, [role='button']"
    );

    if (boton) {
      boton.click();
    } else {
      item.click();
    }

    await new Promise(r => setTimeout(r, 150));
  }

  // ------------------------------------------------------------
  // DESMARCAR LAS QUE ESTÉN MARCADAS
  // ------------------------------------------------------------

  console.log("=== LIMPIANDO SELECCIÓN ===");

  for (const item of seleccionados) {

    const texto = textoItem(item);

    console.log("Desmarcando:", texto);

    await clickItem(item);
  }

  // ------------------------------------------------------------
  // VOLVER A OBTENER LA LISTA
  // ------------------------------------------------------------

  const items2 = [...document.querySelectorAll(
    "li.sapMLIB.interestListCustomListItem"
  )];

  // ------------------------------------------------------------
  // MARCAR LAS 6 OBJETIVO
  // ------------------------------------------------------------

  console.log("=== MARCANDO LAS 6 OBJETIVO ===");

  let marcadas = 0;

  for (const objetivo of OBJETIVOS) {

    const objetivoNorm = norm(objetivo);

    const item = items2.find(i =>
      textoItem(i) === objetivoNorm
    );

    if (!item) {
      console.error("❌ NO ENCONTRADA:", objetivo);
      continue;
    }

    console.log("🖱️ Marcando:", objetivo);

    await clickItem(item);

    marcadas++;
  }

  // ------------------------------------------------------------
  // COMPROBACIÓN
  // ------------------------------------------------------------

  await new Promise(r => setTimeout(r, 500));

  console.log("=== COMPROBACIÓN ===");

  for (const objetivo of OBJETIVOS) {

    const item = [...document.querySelectorAll(
      "li.sapMLIB.interestListCustomListItem"
    )].find(i =>
      textoItem(i) === norm(objetivo)
    );

    if (!item) {
      console.error("❌", objetivo, "→ NO ENCONTRADA");
      continue;
    }

    console.log(
      "•",
      objetivo,
      "\n  class:",
      item.className,
      "\n  aria-selected:",
      item.getAttribute("aria-selected"),
      "\n  aria-checked:",
      item.getAttribute("aria-checked")
    );
  }

  console.log(
    `\nFINAL: ${marcadas}/${OBJETIVOS.length} opciones localizadas.`
  );

})();
