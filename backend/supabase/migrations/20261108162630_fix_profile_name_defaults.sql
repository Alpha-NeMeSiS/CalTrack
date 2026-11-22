/*
  # Correctif : valeur par défaut du prénom et du nom

  first_name et last_name avaient '' comme valeur par défaut, alors que la
  migration 20261108125514 interdit les noms vides (contraintes
  profiles_first_name_check / profiles_last_name_check). L'onboarding, qui
  n'envoie pas de nom, ne pouvait donc plus créer le profil d'un nouvel
  utilisateur. Sans nom, la valeur est désormais NULL.
*/

ALTER TABLE profiles ALTER COLUMN first_name SET DEFAULT NULL;
ALTER TABLE profiles ALTER COLUMN last_name SET DEFAULT NULL;
