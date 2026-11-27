export const chestTiers = [
  { id: 'gray', name: 'Común', chance: 48.4523, rewards: ['Descuento 10 %', 'Descuento 25 %'] },
  { id: 'blue', name: 'Poco común', chance: 27.5297, rewards: ['Descuento 50 %', 'Descuento 75 %', 'Entrada gratis'] },
  { id: 'violet', name: 'Raro', chance: 16.5179, rewards: ['Escudo anti pérdida de PP'] },
  { id: 'pink', name: 'Muy raro', chance: 5, rewards: ['Doble PP por victoria', 'Marco de perfil', 'Fondo de perfil', 'Título de perfil'] },
  { id: 'red', name: 'Legendario', chance: 2.5, rewards: ['Tarjeta Steam · US$5'] },
  { id: 'gold', name: 'Épico', chance: 0.0001, rewards: ['Premio sorpresa'] },
];

export const formatChestChance = (chance:number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 }).format(chance);

export function drawChestReward() {
  const values = new Uint32Array(2);
  globalThis.crypto.getRandomValues(values);
  let roll = (((values[0] >>> 5) * 67_108_864 + (values[1] >>> 6)) / 9_007_199_254_740_992) * 100;
  let tier = chestTiers[0];
  for (const candidate of chestTiers) {
    roll -= candidate.chance;
    if (roll < 0) { tier = candidate; break; }
  }
  const value = globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4_294_967_296;
  return { ...tier, label: tier.rewards[Math.floor(value * tier.rewards.length)] };
}
