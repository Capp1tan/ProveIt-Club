// Catálogo compartido por el formulario y la ficha. Las imágenes son SVG locales.
export const formats = [
  { id: 'ROUND_ROBIN', name: 'Round Robin', tag: 'Todos contra todos', description: 'Cada participante se enfrenta a todos los demás. La clasificación se decide por los resultados acumulados.', example: 'Con 4 participantes se disputan 6 encuentros; cada persona juega 3 veces.', detail: 'Ideal para grupos pequeños que quieren jugar varias veces. Las reglas de puntuación y desempate se acuerdan antes de empezar.' },
  { id: 'SINGLE_ELIMINATION', name: 'Eliminación directa', tag: 'Ganás y avanzás', description: 'Quien gana avanza a la siguiente ronda. Quien pierde queda eliminado hasta que la final define al campeón.', example: 'Con 8 participantes hay 7 encuentros: cuartos, semifinales y final.', detail: 'Rápido y fácil de seguir. Si el número no completa una llave, algunas personas pasan la primera ronda sin jugar.' },
  { id: 'DOUBLE_ELIMINATION', name: 'Doble eliminación', tag: 'Una segunda oportunidad', description: 'La primera derrota te envía a la llave de perdedores. La segunda te elimina. Los ganadores de ambas llaves llegan a la gran final.', example: 'Podés perder un encuentro y todavía llegar al primer puesto.', detail: 'Da más oportunidades y requiere más encuentros. La regla de reinicio de la gran final debe acordarse antes de competir.' },
  { id: 'SWISS', name: 'Sistema suizo', tag: 'Rivales con resultados similares', description: 'Todos compiten durante un número acordado de rondas. Los cruces se organizan entre personas con resultados similares, evitando repetir rivales cuando sea posible.', example: 'Después de una ronda, quienes llevan 1 victoria se emparejan entre sí.', detail: 'Útil cuando hay muchos participantes y no alcanza el tiempo para un todos contra todos.' },
  { id: 'FREE_FOR_ALL', name: 'Todos en una prueba', tag: 'Una prueba, varios rivales', description: 'Varias personas compiten en la misma prueba. El resultado puede definirse por posición, tiempo, puntaje u otra medida acordada.', example: 'Una carrera, un concurso de habilidad o una prueba de tiempo entre amigos.', detail: 'El organizador define cómo se mide el resultado y cuántas personas avanzan si hay varias etapas.' },
];

export function formatImage(id) {
  const box = (x,y,label,w=110) => `<rect x="${x}" y="${y}" width="${w}" height="38" rx="8"/><text x="${x+w/2}" y="${y+24}">${label}</text>`;
  let content = '';
  if (id === 'ROUND_ROBIN') {
    content = '<text x="240" y="30">A · B · C · D</text>' + [ ['Ronda 1','A vs B · C vs D'],['Ronda 2','A vs C · B vs D'],['Ronda 3','A vs D · B vs C'] ].map((r,i)=>box(60,50+i*56,r[0],115)+box(190,50+i*56,r[1],230)).join('');
  } else if (id === 'SINGLE_ELIMINATION') {
    content = '<path d="M145 55H190V100H230 M145 155H190V100 M340 100H365"/>'+box(35,36,'A vs B')+box(35,136,'C vs D')+box(230,81,'Final')+box(365,81,'1.º',75);
  } else if (id === 'DOUBLE_ELIMINATION') {
    content = '<path d="M175 60H250V110H305 M175 175H250V110 M105 80V155"/>'+box(30,41,'Ganadores',145)+box(30,156,'Perdedores',145)+box(305,91,'Gran final',140)+'<text x="320" y="205">2 derrotas = eliminación</text>';
  } else if (id === 'SWISS') {
    content = '<path d="M240 70V100H115V130 M240 100H365V130"/>'+box(170,32,'Ronda 1',140)+box(45,133,'1 victoria',140)+box(295,133,'0 victorias',140)+'<text x="240" y="214">Siguiente ronda: resultados similares</text>';
  } else {
    content = '<path d="M90 90V115H240V145 M390 90V115H240 M190 90V115 M290 90V115"/>'+['A','B','C','D'].map((n,i)=>box(50+i*100,45,n,80)).join('')+box(155,145,'Clasificación',170);
  }
  return `<svg class="format-diagram" viewBox="0 0 480 250" role="img" aria-label="Ejemplo visual de ${formats.find(f=>f.id===id)?.name}" xmlns="http://www.w3.org/2000/svg"><style>.format-diagram rect{fill:#20291e;stroke:#668441}.format-diagram text{fill:#dce8d2;font:13px sans-serif;text-anchor:middle}.format-diagram path{fill:none;stroke:#b8f34c;stroke-width:2}</style>${content}</svg>`;
}


