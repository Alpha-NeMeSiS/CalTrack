# Pesée du matin : seule la pesée à jeun sert au suivi

> Spec courte, validée par l'utilisateur le 28/11/2026 (« c'est bon, code »).
> Version visée : **2.4.0** (nouvelle fonctionnalité). « Copier un repas »
> passe en 2.5.0.

## Pourquoi

Le poids varie d'un à deux kilos dans la journée (eau, repas, digestion).
Exemple de l'utilisateur : 68,1 kg la veille au soir, 66,1 kg le matin à jeun.
Aujourd'hui, toutes les pesées comptent pareil : une pesée du soir fait monter
le poids du profil, les besoins du jour, la progression de l'objectif, la
moyenne de la courbe et l'estimation de la dépense réelle (Tendances). Le suivi
devient bruité et peut faire croire à une prise de poids.

## Ce qui change

### Moment de la pesée

- La carte « Ma pesée » demande le moment : **« Le matin, à jeun »** ou
  **« Plus tard dans la journée »** (boutons radio, légende « Moment de la
  pesée »), avec l'aide : « Le matin, à jeun, après être passé aux toilettes :
  c'est la pesée la plus fiable. »
- Choix proposé d'office :
  - **aujourd'hui** : selon l'heure (avant midi → matin, sinon plus tard) ;
  - **un jour passé** : le moment de la pesée de ce jour s'il y en a une,
    sinon le matin.
- Si le jour affiché a déjà une pesée, la carte la rappelle :
  « Pesée de ce jour : 68,1 kg, le matin à jeun ».

### Ce qui compte dans le suivi

- **Pesée de référence** = pesée du matin. Une pesée « plus tard » compte
  **seulement s'il n'y a aucune pesée du matin dans les 14 jours qui la
  précèdent** (quelqu'un qui se pèse toujours le soir garde un suivi).
- Seules les pesées de référence alimentent : le poids du profil (donc les
  besoins du jour et la progression de l'objectif), « Dernière » et « sur
  7 jours » de la carte, la moyenne sur 7 jours de la courbe et l'estimation
  de la dépense réelle.
- Les autres pesées « plus tard » restent enregistrées et visibles sur la
  courbe (point creux, légende « pesée plus tard dans la journée, hors suivi »).
- Les pesées existantes comptent comme pesées du matin : l'historique ne bouge
  pas.

### Une pesée par jour : qui l'emporte

La base garde une seule pesée par jour (inchangé).

| Pesée du jour déjà enregistrée | Nouvelle pesée | Résultat |
| --- | --- | --- |
| aucune, ou « plus tard » | matin ou plus tard | enregistrée (remplace) |
| matin | matin | remplace (correction) |
| matin | plus tard, **autre poids** | **refusée** : « Votre pesée du matin (66,1 kg) reste celle de ce jour. Pour la corriger, choisissez « Le matin, à jeun ». » |
| matin | plus tard, **même poids ou champ vide** | le moment passe à « plus tard » (correction du moment) |

La dernière ligne sert à corriger les anciennes pesées : la pesée de 68,1 kg
d'hier soir, enregistrée comme pesée du matin, se corrige en revenant sur ce
jour dans le journal, en choisissant « Plus tard dans la journée » puis
« Mettre à jour » (le bouton est actif sans poids saisi quand seul le moment
change).

Après l'enregistrement d'une pesée « plus tard » qui ne compte pas :
« Pesée enregistrée. Elle reste hors suivi : la pesée du matin sert de
référence. »

## Non-objectifs

- Pas deux pesées par jour (matin et soir) : il faudrait supprimer ou modifier
  des pesées, et il n'existe pas d'écran pour cela.
- Pas d'heure exacte enregistrée.
- La courbe de composition (masse grasse, muscles) reste inchangée.

## Approches envisagées

| Retenue | Écartées |
| --- | --- |
| **Colonne `moment` sur la pesée du jour** (une pesée par jour, le matin l'emporte) : petite migration sans risque, pas d'écran nouveau | Deux pesées par jour (clé unique élargie : il faut un écran pour supprimer une pesée fausse, toutes les recherches « pesée de ce jour » changent) ; corriger automatiquement le poids du soir d'un écart moyen (invente une valeur, l'écart varie selon les personnes) |

## Laissé à l'implémentation

- Migration : `moment text NOT NULL DEFAULT 'morning'`, contrainte
  `moment IN ('morning', 'later')`. L'application en production (2.3.0) ne
  l'envoie pas : la valeur par défaut s'applique et un enregistrement sans
  `moment` garde le moment déjà enregistré. Migration appliquée avant le
  déploiement, sans risque pour la version en ligne.
- Calcul pur et testé dans `weights.ts` : sélection des pesées de référence,
  moment proposé d'office.
- `recordWeight` : après l'enregistrement, le profil suit la dernière pesée de
  référence, seulement si la pesée enregistrée est la plus récente (une pesée
  antidatée ne change rien, comme aujourd'hui). La composition saisie n'entre
  dans le profil que si la pesée compte.
- Le refus « plus tard » sur « matin » est fait dans la carte, qui connaît déjà
  la pesée du jour.
