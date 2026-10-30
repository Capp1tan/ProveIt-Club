// La categoría es explícita: nunca se deduce del nombre ni de un símbolo de moneda.
export const prizeTypes = { MONEY:'Dinero', SURPRISE:'Regalo sorpresa', FOOD:'Comida o bebida', TECH:'Tecnología', CLOTHING:'Ropa o accesorios', EXPERIENCE:'Experiencia', OTHER:'Otro premio' };
export function prizeIcon(type) {
  const paths = {
    MONEY:['M2 5h20v14H2Z','M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z','M5 8v1m14 6v1'],
    SURPRISE:['M3 8h18v4H3Zm2 4v9h14v-9M12 8v13','M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3Z'],
    FOOD:['M4 3v6a3 3 0 0 0 6 0V3M7 3v18','M18 3c-3 2-4 5-4 9h4m0-9v18'],
    TECH:['M3 3h18v13H3Zm9 13v5m-4 0h8'], CLOTHING:['m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4','M8 3a4 4 0 0 0 8 0'],
    EXPERIENCE:['M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4Z','M15 6v2m0 3v2m0 3v2'],
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  for (const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'})) svg.setAttribute(key,value);
  for (const d of ['M8 3h8v6a4 4 0 0 1-8 0V3Z','M8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 13v6m-4 2h8m-8-2h8']) { const path = document.createElementNS(svg.namespaceURI,'path'); path.setAttribute('d',d); svg.append(path); }
  return svg;
}
