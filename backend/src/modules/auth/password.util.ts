import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

export const PASSWORD_MIN_LENGTH = 8;

/** Politique minimale : 8 caractères, au moins une lettre et un chiffre. */
export function assertPasswordPolicy(password: string): void {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    throw new BadRequestException(`Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`);
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new BadRequestException('Le mot de passe doit contenir au moins une lettre et un chiffre');
  }
}

/** Mot de passe temporaire lisible (sans caractères ambigus 0/O, 1/l/I). */
export function generateTemporaryPassword(length = 12): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = letters + digits + '!@#$';
  const pick = (set: string) => set[crypto.randomInt(set.length)];
  const chars = [pick(letters), pick(digits), ...Array.from({ length: length - 2 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
