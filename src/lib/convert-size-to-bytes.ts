type Unit = 'B' | 'KB' | 'MB' | 'GB' | 'TB';

const units: Record<Unit, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

export function convertSizeToBytes(value: number, unit: Unit): number {
  if (!units[unit]) {
    throw new Error('Invalid unit. Use B, KB, MB, GB, TB, or PB.');
  }

  if (value < 0) {
    throw new Error('Value cannot be negative.');
  }

  return value * units[unit];
}
