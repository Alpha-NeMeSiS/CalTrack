// Prises d'eau d'un jour du journal : chargement, ajout, annulation de la
// dernière prise. Un seul envoi à la fois (pas de double ajout).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WaterLog } from '../../lib/supabase';
import { addWaterLog, deleteWaterLog, fetchWaterLogs } from '../../services/water';
import { lastWaterLog, waterTotal } from '../../utils/water';

const SAVE_ERROR = 'L’eau n’a pas pu être enregistrée. Réessayez.';

export function useWaterDay(userId: string | undefined, date: string) {
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // Jour affiché : une réponse arrivée pour un autre jour est ignorée
  const currentDate = useRef(date);
  currentDate.current = date;

  const reload = useCallback(async () => {
    if (!userId) return;
    const requested = date;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchWaterLogs(userId, requested, requested);
      if (currentDate.current === requested) setLogs(rows);
    } catch (err) {
      console.error("Erreur de chargement de l'eau", err);
      if (currentDate.current === requested) setError('L’eau du jour n’a pas pu être chargée.');
    } finally {
      if (currentDate.current === requested) setLoading(false);
    }
  }, [userId, date]);

  useEffect(() => {
    setLogs([]);
    void reload();
  }, [reload]);

  /** Exécute une écriture à la fois ; renvoie false si elle a échoué ou si une autre est en cours. */
  const run = useCallback(async (action: () => Promise<void>) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      console.error("Erreur d'enregistrement de l'eau", err);
      setError(SAVE_ERROR);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const add = useCallback(
    (amountMl: number) =>
      run(async () => {
        if (!userId) throw new Error('Utilisateur non connecté');
        const saved = await addWaterLog(userId, date, amountMl);
        if (currentDate.current === date) setLogs((current) => [...current, saved]);
      }),
    [run, userId, date]
  );

  const undoLast = useCallback(
    () =>
      run(async () => {
        const last = lastWaterLog(logs);
        if (!last) return;
        await deleteWaterLog(last.id);
        setLogs((current) => current.filter((log) => log.id !== last.id));
      }),
    [run, logs]
  );

  return { logs, totalMl: waterTotal(logs), last: lastWaterLog(logs), loading, error, busy, add, undoLast, reload };
}
