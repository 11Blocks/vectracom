import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marque une route comme publique (login, healthcheck…) : bypass JWT + guards. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
