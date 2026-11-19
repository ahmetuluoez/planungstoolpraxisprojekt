export const f1 = (x: number) => x.toLocaleString('de-CH', { maximumFractionDigits: 0 });
export const pz = (x: number | null) => (x === null ? 'keine Kapazität' : `${Math.round(x * 100)} %`);
