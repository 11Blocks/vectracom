import type { NextFunction, Request, Response } from 'express';
import type { JwtService } from '@nestjs/jwt';
import { GREEN_T_ROLES } from './decorators/roles.decorator';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Protège /uploads : jeton requis (en-tête Bearer ou ?token=, les balises <img>/<a> ne pouvant pas
 * envoyer d'en-tête). Les fichiers rangés sous /uploads/<catégorie>/<companyId>/ ne sont servis
 * qu'au tenant propriétaire (et à la console Green-T). UPLOADS_PUBLIC=true désactive le contrôle.
 */
export function uploadsGuard(jwt: JwtService) {
  const open = process.env.UPLOADS_PUBLIC === 'true';
  return async (req: Request, res: Response, next: NextFunction) => {
    if (open || req.method === 'OPTIONS') return next();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : typeof req.query.token === 'string' ? req.query.token : null;
    if (!token) return res.status(401).json({ statusCode: 401, message: 'Authentification requise' });
    let payload: { companyId?: string | null; role?: string };
    try {
      payload = await jwt.verifyAsync(token);
    } catch {
      return res.status(401).json({ statusCode: 401, message: 'Session expirée — reconnectez-vous' });
    }
    const owner = req.path.split('/').filter(Boolean)[1];
    if (owner && UUID.test(owner) && owner !== payload.companyId && !GREEN_T_ROLES.includes(payload.role ?? '')) {
      return res.status(403).json({ statusCode: 403, message: 'Fichier d’un autre tenant' });
    }
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return next();
  };
}
