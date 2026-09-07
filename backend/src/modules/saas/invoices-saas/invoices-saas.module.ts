import { Module } from '@nestjs/common';
import { SaasModule } from '../saas.module';

/**
 * Point d'entrée dédié à la facturation SaaS : les providers vivent dans
 * SaasModule (dépendances partagées SaasService/SubscriptionService sans
 * cycle) ; ce module les re-export pour les consommateurs externes.
 */
@Module({
  imports: [SaasModule],
  exports: [SaasModule],
})
export class InvoicesSaasModule {}
