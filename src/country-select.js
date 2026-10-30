// País de la cuenta: privado. No se usa para adivinar el huso horario.
export function countrySelect(select){
 const items=[['','Elegí tu país'],['AR','Argentina'],['CL','Chile'],['PY','Paraguay'],['UY','Uruguay'],['PE','Perú'],['BR','Brasil']];
 for(const [value,name] of items){const o=document.createElement('option');o.value=value;o.textContent=name;select.append(o);}return select;
}
