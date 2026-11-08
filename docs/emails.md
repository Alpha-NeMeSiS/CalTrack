# Emails de connexion (Supabase Auth)

Ce guide explique comment CalTrack envoie ses emails (inscription, mot de passe
oublié, changement d’adresse) et comment les rendre **fiables** : un service
d’envoi (SMTP) à vous et des modèles **en français**.

Tout se règle dans le tableau de bord Supabase ; rien n’est à déployer côté
application. Les mots de passe SMTP restent dans Supabase : ne les mettez jamais
dans le dépôt.

## Comment ça marche

1. L’application demande l’email à Supabase Auth, par exemple
   `resetPasswordForEmail()` pour « Mot de passe oublié » (voir
   `src/contexts/AuthContext.tsx`).
2. Supabase envoie l’email à partir du **modèle** correspondant. Le bouton pointe
   vers `https://<projet>.supabase.co/auth/v1/verify?token=…&redirect_to=…`.
3. En cliquant, Supabase vérifie le jeton (valable une fois, 1 h par défaut) puis
   redirige vers l’application (`redirect_to`, qui doit figurer dans
   **Authentication → URL Configuration → Redirect URLs**) avec la session dans
   l’URL.
4. L’application lit l’URL : pour un lien « mot de passe oublié », elle affiche
   l’écran « Nouveau mot de passe » ; pour une confirmation, elle affiche un
   bandeau de succès ou d’erreur (`src/utils/authRedirect.ts`).

| Email                         | Envoyé quand                                                   | Modèle Supabase      |
| ----------------------------- | -------------------------------------------------------------- | -------------------- |
| Confirmation d’inscription    | création de compte (si « Confirm email » est activé)            | Confirm signup       |
| Réinitialisation du mot de passe | « Mot de passe oublié ? » sur l’écran de connexion           | Reset password       |
| Changement d’adresse          | « Mon profil → Adresse email »                                  | Change email address |
| Code de confirmation          | seulement si « Secure password change » est activé (voir plus bas) | Reauthentication  |

## Pourquoi un SMTP personnalisé ?

Sans réglage, Supabase utilise son service d’envoi intégré, prévu pour les essais :

- il n’envoie **qu’aux adresses des membres de l’organisation Supabase** (onglet
  *Team*). Pour tous les autres utilisateurs, l’envoi échoue
  (`email_address_not_authorized`) : l’application affiche alors « L’email n’a
  pas pu être envoyé à cette adresse… » ;
- il est limité à **quelques emails par heure** pour tout le projet ;
- l’expéditeur est une adresse Supabase, souvent classée en indésirables.

C’est pour ça que « Mot de passe oublié » fonctionne avec votre propre adresse
mais ne fonctionnerait pas pour un autre utilisateur.

## Étape 1 — Choisir un service d’envoi

N’importe quel service compatible SMTP fonctionne. Deux choix simples, avec une
offre gratuite suffisante pour démarrer (vérifiez les quotas actuels sur leur
site) :

| Service | Ce qu’il faut | Réglages SMTP |
| ------- | ------------- | ------------- |
| **Resend** (recommandé) | un **nom de domaine** à vous (ex. `caltrack.fr`), vérifié en ajoutant les enregistrements DNS qu’il donne | hôte `smtp.resend.com`, port `465`, utilisateur `resend`, mot de passe = une clé API Resend |
| **Brevo** | un domaine (conseillé) ou, à défaut, une adresse d’expéditeur vérifiée | hôte `smtp-relay.brevo.com`, port `587`, identifiant et clé SMTP affichés dans Brevo (*SMTP & API*) |

> L’application est hébergée sur `caltrack-ap.netlify.app` : ce sous-domaine
> Netlify ne peut pas servir d’expéditeur (impossible d’y ajouter des
> enregistrements DNS). Un nom de domaine coûte une dizaine d’euros par an et
> peut aussi servir d’adresse au site (Netlify → *Domain management*). Sans
> domaine, Brevo avec une adresse vérifiée fonctionne, mais les emails risquent
> davantage d’arriver en indésirables.

Si vous avez un domaine, configurez aussi **SPF, DKIM et DMARC** (le service
d’envoi donne les enregistrements à copier) : c’est ce qui évite les
indésirables.

## Étape 2 — Brancher le SMTP dans Supabase

**Authentication → Emails → SMTP Settings** → activer *Enable custom SMTP* :

| Champ | Valeur |
| ----- | ------ |
| Sender email | `no-reply@votre-domaine` (ou l’adresse vérifiée dans Brevo) |
| Sender name | `CalTrack` |
| Host / Port / Username / Password | ceux du service choisi (tableau ci-dessus) |

Enregistrez. À partir de là, Supabase envoie à **toutes** les adresses.

## Étape 3 — Ajuster la limite d’envoi

Avec un SMTP personnalisé, Supabase limite d’abord l’envoi à **30 emails par
heure** pour protéger la réputation du nouveau service. C’est suffisant au
début ; pour l’augmenter : **Authentication → Rate Limits** (*Rate limit for
sending emails*). Restez sous le quota de votre service d’envoi.

Si un utilisateur demande plusieurs liens d’affilée, l’application affiche
« Trop d’emails envoyés : patientez quelques minutes… ».

## Étape 4 — Coller les modèles en français

Les modèles sont dans [`supabase/templates/`](../supabase/templates). Pour
chacun : **Authentication → Emails → Templates**, choisir le modèle, remplacer
le sujet, puis coller tout le contenu du fichier HTML dans *Message body*
(onglet *Source*).

| Modèle Supabase | Sujet | Fichier |
| --------------- | ----- | ------- |
| Confirm signup | `Confirmez votre adresse email CalTrack` | `confirmation.html` |
| Reset password | `Réinitialisez votre mot de passe CalTrack` | `recovery.html` |
| Change email address | `Confirmez votre nouvelle adresse email CalTrack` | `email_change.html` |
| Reauthentication | `Votre code de confirmation CalTrack` | `reauthentication.html` |

Les modèles *Magic link* et *Invite user* ne sont pas utilisés par
l’application.

Les modèles utilisent les variables de Supabase : `{{ .ConfirmationURL }}`
(lien du bouton), `{{ .Email }}` (adresse du compte), `{{ .NewEmail }}`
(nouvelle adresse, changement d’email) et `{{ .Token }}` (code à 6 chiffres).
Ne les traduisez pas. Le logo est chargé depuis
`https://caltrack-ap.netlify.app/icons/icon-192.png`.

Pour modifier un modèle : éditez le fichier dans `supabase/templates/`, ouvrez-le
dans un navigateur pour vérifier le rendu, puis recollez-le dans Supabase (les
deux doivent rester identiques).

## Étape 5 — Tester

1. Sur l’écran de connexion, « Mot de passe oublié ? » avec une adresse **qui
   n’est pas** membre de l’organisation Supabase (un deuxième compte de test).
2. L’email arrive en français, depuis votre expéditeur. Le bouton ouvre
   l’application sur « Nouveau mot de passe ».
3. Rien reçu ? Regardez les indésirables, puis **Logs → Auth** dans Supabase
   (recherche `mail`) et les journaux d’envoi de votre service (Resend / Brevo).

## Bon à savoir

- **Durée des liens** : 1 h par défaut (**Authentication → Sign In / Providers →
  Email → Email OTP Expiration**). Le texte de `recovery.html` l’indique : à
  adapter si vous changez la durée.
- **Secure email change** (activé par défaut) : un lien est envoyé à
  l’ancienne **et** à la nouvelle adresse ; il faut cliquer sur les deux.
- **Secure password change** : laissez-le **désactivé**. S’il est activé,
  Supabase exige un code (modèle *Reauthentication*) pour changer le mot de passe
  d’une session ouverte depuis plus de 24 h, et l’application ne propose pas
  encore de saisir ce code ; elle demande alors de se déconnecter puis de se
  reconnecter.
- **Redirect URLs** : gardez `https://caltrack-ap.netlify.app/**` (et les
  aperçus Netlify si vous les testez), sinon les liens ramènent sur la page par
  défaut au lieu de l’application.
