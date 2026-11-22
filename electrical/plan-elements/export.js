/* Exportação autónoma: o PDF é criado pelo diálogo de impressão do navegador. */
(function () {
  'use strict';

  const categories = [
    { name: 'Iluminação e comandos', kinds: ['lamp', 'wall', 'btn', 'blind', 'fan'] },
    { name: 'Tomadas e equipamentos', kinds: ['sock', 'tr', 'ev', 'hvac', 'ac'] },
    { name: 'ITED', kinds: ['data', 'tv', 'ms', 'ap'] }
  ];
  const kinds = {
    lamp: ['L', 'Ponto de luz', '#ad591c'],
    wall: ['AP', 'Luminária de parede', '#ad591c'],
    btn: ['B', 'Botão', '#ad591c'],
    blind: ['E', 'Estores', '#ad591c'],
    fan: ['V', 'Ventilador', '#ad591c'],
    sock: ['T', 'Tomada', '#225d91'],
    tr: ['TR', 'Toalheiro', '#225d91'],
    ev: ['VE', 'Carregamento de veículo elétrico', '#225d91'],
    hvac: ['AV', 'AVAC', '#225d91'],
    ac: ['AC', 'Ar condicionado', '#225d91'],
    data: ['D', 'Dados', '#537043'],
    tv: ['TV', 'Televisão', '#537043'],
    ms: ['MS', 'Sensor de movimento', '#537043'],
    ap: ['AP', 'Ponto de acesso', '#537043']
  };
  const floors = [['g', 'Piso térreo'], ['s', 'Sótão']];
  const svgNS = 'http://www.w3.org/2000/svg';

  window.exportPlan = function (points, backgrounds) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Permita janelas de contexto para exportar a planta em PDF.');
      return;
    }

    const doc = printWindow.document;
    doc.title = 'Plantas propostas — exportação';
    doc.documentElement.lang = 'pt';
    const style = doc.createElement('style');
    style.textContent = `
      @page { size: A4 landscape; margin: 8mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #20282b; font-family: Arial, sans-serif; }
      .instructions { padding: 12px 18px; background: #edf2ee; font-size: 14px; }
      .instructions button { margin-left: 12px; padding: 6px 12px; cursor: pointer; }
      .sheet { height: 194mm; display: flex; flex-direction: column; break-after: page; page-break-after: always; }
      .sheet:last-child { break-after: auto; page-break-after: auto; }
      header { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 1px solid #263737; padding: 2mm 0; }
      h1 { margin: 0; font-size: 15pt; } header span { font-size: 9pt; }
      .content { display: flex; flex: 1; min-height: 0; gap: 5mm; padding-top: 2mm; }
      .plan { flex: 1; min-width: 0; min-height: 0; }
      .plan svg { display: block; width: 100%; height: 100%; }
      aside { width: 48mm; flex: none; font-size: 8pt; line-height: 1.35; }
      h2 { margin: 0 0 2mm; font-size: 10pt; }
      .legend { list-style: none; margin: 0; padding: 0; }
      .legend li { margin-bottom: 2mm; display: flex; align-items: center; gap: 2mm; }
      .symbol { width: 7mm; height: 7mm; border: 1px solid currentColor; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex: none; font-weight: bold; font-size: 6pt; }
      .notice { border-top: 1px solid #a9b2ae; margin-top: 4mm; padding-top: 3mm; }
      footer { font-size: 7pt; border-top: 1px solid #a9b2ae; padding-top: 1mm; }
      @media print { .instructions { display: none; } }
    `;
    doc.head.appendChild(style);

    function element(parent, tag, text, className) {
      const node = doc.createElement(tag);
      if (text != null) node.textContent = text;
      if (className) node.className = className;
      parent.appendChild(node);
      return node;
    }
    function svgElement(parent, tag, attributes) {
      const node = doc.createElementNS(svgNS, tag);
      Object.keys(attributes).forEach(function (key) { node.setAttribute(key, String(attributes[key])); });
      parent.appendChild(node);
      return node;
    }

    const instructions = element(doc.body, 'div', 'Na janela de impressão, selecione «Guardar como PDF» como destino. Confirme que as imagens das plantas estão visíveis antes de guardar.', 'instructions');
    const printButton = element(instructions, 'button', 'Imprimir / guardar em PDF');
    printButton.type = 'button';
    printButton.addEventListener('click', function () { printWindow.print(); });

    const imageLoads = [];
    floors.forEach(function (floor) {
      const background = new URL(backgrounds[floor[0]], window.location.href).href;
      categories.forEach(function (category) {
        const sheet = element(doc.body, 'section', null, 'sheet');
        const header = element(sheet, 'header');
        element(header, 'h1', category.name);
        element(header, 'span', floor[1] + ' · Proposta não aprovada');
        const content = element(sheet, 'div', null, 'content');
        const plan = element(content, 'div', null, 'plan');
        const svg = svgElement(plan, 'svg', { viewBox: '0 0 815 1270', role: 'img', 'aria-label': 'Planta: ' + floor[1] + ', ' + category.name });
        svgElement(svg, 'image', { href: background, x: 0, y: 0, width: 815, height: 1270 });
        points.filter(function (point) {
          return point.origin !== 'projeto-divergente' && point.floor === floor[0] && category.kinds.includes(point.kind) && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y));
        }).forEach(function (point) {
          const info = kinds[point.kind];
          const group = svgElement(svg, 'g', { transform: 'translate(' + Number(point.x) + ' ' + Number(point.y) + ')' });
          const title = svgElement(group, 'title', {});
          title.textContent = [point.id, point.label, point.circ && 'Circuito: ' + point.circ, point.h != null && 'Altura: ' + point.h + ' m'].filter(Boolean).join(' · ');
          if (point.svg) {
            const art = svgElement(group, 'g', { stroke: '#e8141c', fill: 'none' });
            art.innerHTML = point.svg;
            return;
          }
          if (Number.isFinite(point.length) && Number.isFinite(point.angle)) {
            svgElement(group, 'line', { x1: -point.length / 2, y1: 0, x2: point.length / 2, y2: 0, transform: 'rotate(' + point.angle + ')', stroke: info[2], 'stroke-width': 3 });
          }
          svgElement(group, 'circle', { r: 11, fill: '#fff', stroke: info[2], 'stroke-width': 2.5, 'stroke-dasharray': !String(point.origin).startsWith('arquitetura') ? '4 3' : 'none' });
          const text = svgElement(group, 'text', { x: 0, y: 3, 'text-anchor': 'middle', 'font-family': 'Arial, sans-serif', 'font-size': info[0].length > 1 ? 8 : 10, 'font-weight': 'bold', fill: info[2] });
          text.textContent = info[0];
          const label = svgElement(group, 'text', { x: 14, y: -8, 'font-family': 'Arial, sans-serif', 'font-size': 9, 'font-weight': 'bold', fill: info[2], stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke' });
          label.textContent = [point.ref || point.id, point.circ, point.h != null ? 'h=' + point.h + 'm' : ''].filter(Boolean).join(' · ');
        });
        const aside = element(content, 'aside');
        element(aside, 'h2', 'Legenda');
        const legend = element(aside, 'ul', null, 'legend');
        category.kinds.forEach(function (kind) {
          const item = element(legend, 'li');
          const symbol = element(item, 'span', kinds[kind][0], 'symbol');
          symbol.style.color = kinds[kind][2];
          element(item, 'span', kinds[kind][1]);
        });
        element(aside, 'p', 'Símbolos vermelhos: elementos do desenho de arquitetura (DWG 01.02), com etiqueta e letra de circuito; círculos tracejados: acrescentado do projeto ELE.5 / ITE.4 ou criado pelo utilizador.', 'notice');
        element(aside, 'p', 'Proposta de localização de pontos. Documento não aprovado, sujeito a revisão e validação por técnico habilitado.', 'notice');
        element(aside, 'p', 'A impressão pode alterar as dimensões. Não utilizar para medições.');
        element(sheet, 'footer', 'Planta indicativa · Não substitui o projeto de execução aprovado');
      });
      imageLoads.push(new Promise(function (resolve) {
        const image = new Image();
        image.onload = function () { resolve(true); };
        image.onerror = function () { resolve(false); };
        image.src = background;
      }));
    });
    Promise.all(imageLoads).then(function (loaded) {
      if (loaded.every(Boolean)) {
        printWindow.focus();
        printWindow.print();
      } else {
        instructions.firstChild.textContent = 'Não foi possível carregar uma ou mais plantas de arquitetura. Verifique as imagens antes de imprimir ou guardar em PDF.';
      }
    });
  };
}());
