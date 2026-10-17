// Prefijos visibles: el servidor sigue validando el número completo con libphonenumber.
const countries=[
  {id:'AR',name:'Argentina',prefix:'+549',label:'+54 9',example:'11 2345 6789',help:'Código de área + número, sin 0 ni 15. Ejemplo: 11 2345 6789.'},
  {id:'CL',name:'Chile',prefix:'+56',label:'+56',example:'9 1234 5678',help:'Número de 9 dígitos. Ejemplo móvil: 9 1234 5678.'},
  {id:'PY',name:'Paraguay',prefix:'+595',label:'+595',example:'981 234567',help:'Código de área u operadora + número, sin el 0 inicial.'},
  {id:'UY',name:'Uruguay',prefix:'+598',label:'+598',example:'99 123 456',help:'Número de 8 dígitos, sin el 0 inicial.'},
  {id:'PE',name:'Perú',prefix:'+51',label:'+51',example:'912 345 678',help:'Número móvil de 9 dígitos; para fijos incluí el código de área.'},
  {id:'BR',name:'Brasil',prefix:'+55',label:'+55',example:'11 91234 5678',help:'DDD de 2 dígitos + número, sin el 0 inicial.'},
];
export function mountPhoneCountry(){
  const select=document.getElementById('phoneCountry'),input=document.getElementById('phoneNational'),prefix=document.getElementById('phonePrefix'),help=document.getElementById('phoneHelp');
  let legacyPrefix='';
  for(const country of countries){const option=document.createElement('option');option.value=country.id;option.textContent=country.name+' ('+country.label+')';select.append(option);}
  const country=()=>countries.find(c=>c.id===select.value) || countries[0];
  const update=()=>{const c=country();prefix.textContent=legacyPrefix || c.label;input.placeholder=c.example;help.textContent=c.help;};
  select.addEventListener('change',()=>{legacyPrefix='';update();});update();
  return {
    load(number){
      if(!number){input.value='';return;}
      let c=countries.find(c=>number.startsWith(c.prefix));
      if(!c && number.startsWith('+54')){c=countries[0];legacyPrefix='+54';}
      if(c){select.value=c.id;input.value=number.slice((legacyPrefix || c.prefix).length);update();}
      else{input.value=number;help.textContent='Tu número anterior se conserva completo. Elegí un país para reemplazarlo.';}
    },
    value(){
      const raw=input.value.trim();if(!raw)return '';
      // También se acepta pegar un número internacional completo sin duplicar el prefijo.
      if(raw.startsWith('+'))return '+'+raw.replace(/\D/g,'');
      let digits=raw.replace(/\D/g,'').replace(/^0+/,'');
      return (legacyPrefix || country().prefix)+digits;
    },
    optional(value){input.required=!value;document.getElementById('phoneRequirement').textContent=value?'opcional para tu cuenta · privado':'obligatorio · privado';},
  };
}
