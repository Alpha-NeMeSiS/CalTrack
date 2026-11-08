-- Outils des tests de la base (chargés après les migrations).
--
--   SELECT test.create_user('a');            -- utilisateur + profil de test
--   SELECT test.login(test.uid('a'));        -- « connecte » l'utilisateur
--   SET ROLE authenticated;                  -- agit comme l'API (RLS active)
--   SELECT test.ok(condition, 'message');
--   SELECT test.raises($$ SQL $$, '23514', 'message');  -- erreur attendue
--   RESET ROLE;
--
-- Chaque fichier de test tourne dans une transaction annulée à la fin.

CREATE SCHEMA test;
GRANT USAGE ON SCHEMA test TO anon, authenticated, service_role;

-- Identifiant stable d'un utilisateur de test à partir d'un nom court
CREATE FUNCTION test.uid(p_name text) RETURNS uuid
LANGUAGE sql IMMUTABLE
AS $$ SELECT md5('caltrack-test-' || p_name)::uuid $$;

-- Crée un compte (auth.users) et, sauf demande contraire, son profil
CREATE FUNCTION test.create_user(p_name text, p_with_profile boolean DEFAULT true) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid := test.uid(p_name);
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_id, p_name || '@test.caltrack');
  IF p_with_profile THEN
    INSERT INTO public.profiles (id, email, sexe, date_naissance, taille_cm, poids_kg)
    VALUES (v_id, p_name || '@test.caltrack', 'M', '1990-01-01', 175, 70);
  END IF;
  RETURN v_id;
END $$;

CREATE FUNCTION test.login(p_user uuid) RETURNS void
LANGUAGE sql
AS $$ SELECT set_config('request.jwt.claim.sub', p_user::text, false) $$;

CREATE FUNCTION test.ok(p_condition boolean, p_message text) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'ÉCHEC : %', p_message;
  END IF;
  RAISE NOTICE 'ok - %', p_message;
END $$;

-- Exécute une requête qui doit échouer avec le code SQLSTATE donné
-- (23514 contrainte CHECK, 23505 doublon, 42501 refus RLS / droits…)
CREATE FUNCTION test.raises(p_sql text, p_sqlstate text, p_message text) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = p_sqlstate THEN
      RAISE NOTICE 'ok - %', p_message;
      RETURN;
    END IF;
    RAISE EXCEPTION 'ÉCHEC : % (erreur % au lieu de % : %)', p_message, SQLSTATE, p_sqlstate, SQLERRM;
  END;
  RAISE EXCEPTION 'ÉCHEC : % (aucune erreur, % attendue)', p_message, p_sqlstate;
END $$;

-- Nombre de lignes modifiées par une requête (UPDATE / DELETE filtrés par RLS)
CREATE FUNCTION test.affected(p_sql text) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA test TO anon, authenticated, service_role;
