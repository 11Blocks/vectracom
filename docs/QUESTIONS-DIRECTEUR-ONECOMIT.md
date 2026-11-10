Objet : VECTRACOM — 9 points à valider pour finaliser les évolutions

Bonjour Monsieur le Directeur,

Les évolutions décidées lors de notre réunion sont en production (Items, zones et pilotes, permanence, renforts, achats SONATEL, rémunération 65/35, cartographie). Pour terminer, nous avons besoin de votre arbitrage sur 9 points. Pour chacun, nous indiquons ce que nous appliquerons par défaut si nous n'avons pas de réponse d'ici le [date à compléter].

1. Les 5 rubriques du stock (Q_B2)
Nous avons compris que les 5 rubriques sont : Stock, Focus Stock, Suivi Consommation, Comptabilité Matière, Ventilation aux Équipes.
Question : les 5 rubriques de stock doivent-elles être filtrées par item (FTTH, INFRA…), ou sont-elles globales ?
Pourquoi c'est bloquant : l'organisation des écrans de stock, les inventaires et le suivi des pertes (seuil de 10 %) en dépendent.
Par défaut : nous partons sur des rubriques filtrées par item, mais nous ne développerons rien avant votre confirmation.

2. L'import SONATEL « 5 feuilles à l'identique »
Question : pouvez-vous nous confirmer les 5 feuilles du fichier SONATEL à importer et leur rôle ? (Nous avons identifié : Planning, Affectation, Surcharges, Traitées, Dispositif.) Une feuille doit-elle créer ou modifier des missions, ou seulement être consultable ?
Pourquoi c'est bloquant : aujourd'hui, seules les feuilles Planning et Affectation sont importées. Une mauvaise lecture des autres créerait des doublons ou écraserait des données.
Par défaut : les 5 feuilles sont importées et affichées à l'identique (mêmes colonnes, mêmes libellés), mais seule la feuille Planning crée des missions. Les autres restent en consultation.

3. La facturation par équipe
Question : avez-vous besoin d'une vraie facture par équipe ou par groupe, en plus de la facture ONECOMIT → client ? Ou un relevé par équipe suffit-il ?
Pourquoi c'est bloquant : une facture par équipe implique une numérotation et une comptabilité séparées, ce qui représente un chantier important.
Par défaut : nous ajoutons un relevé par équipe et par mois (missions validées, montants, export Excel), sans numéro de facture.

4. Le format « zone x/y » (ex. Mbour 53/53)
Question : que représentent les deux chiffres ? Équipes affectées / équipes prévues, ou autre chose ?
Pourquoi c'est bloquant : la cartographie (zones saturées, productives, bloquées) se calcule à partir de ces chiffres.
Par défaut : x = équipes affectées, y = équipes prévues.

5. Le sens des « instances »
Question : les « instances » d'un chef (de 1 à 8, total 376) sont-elles le nombre de techniciens qu'il encadre, ou le nombre d'interventions en cours ?
Pourquoi c'est bloquant : cela change le tableau DISPOSITIF et le calcul de charge des pilotes.
Par défaut : nombre d'interventions actives par chef.

6. Le niveau 2 de la chaîne de sous-traitance
Question : dans la chaîne SONATEL → SOFATELCOM → ONECOMIT → sous-traitant, le niveau 2 est-il toujours ONECOMIT ? Existe-t-il des cas avec un intermédiaire supplémentaire ?
Pourquoi c'est bloquant : le calcul en cascade des pourcentages (65 %, 80 %…) suppose un nombre de niveaux connu.
Par défaut : 3 niveaux, avec ONECOMIT au niveau 2. Le système accepte quand même un niveau supplémentaire si besoin.

7. La satisfaction client
Question : par quel canal le client final donne-t-il son avis (SMS, WhatsApp, application) ? Qui le recueille : le client lui-même ou le chef d'équipe sur place ?
Pourquoi c'est bloquant : cela détermine s'il faut un envoi automatique (SMS ou WhatsApp, avec un coût) ou une simple saisie dans l'application mobile.
Par défaut : le chef d'équipe saisit la note (propreté, comportement, de 1 à 5) avec le client à la clôture de la mission, sur le mobile.

8. La prestation « S+I APP » (Q7)
Question : « S+I APP » est-il une variante appartement de « Survey + Installation » ? Si oui, quel nom de prestation devons-nous utiliser ?
Pourquoi c'est bloquant : son taux de reversement (80 %) est différent des autres prestations ; sans prestation distincte, il ne peut pas être appliqué.
Par défaut : nous appliquons la règle « Survey + Installation » existante, sans taux spécifique « APP ».

9. La prestation « PASSAGE » (Q8)
Question : « PASSAGE » correspond-il au « Déplacement SAV », ou à une autre prestation ?
Pourquoi c'est bloquant : son taux de reversement (87 %) doit être rattaché à la bonne prestation.
Par défaut : aucun taux « PASSAGE » n'est appliqué tant que la correspondance n'est pas confirmée ; la règle par défaut s'applique.

Nous restons disponibles pour en parler de vive voix.

Cordialement,
Moussa — Green-T
