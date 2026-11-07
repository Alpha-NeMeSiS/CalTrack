// Faux client Supabase pour les tests.
//
// Chaque appel `supabase.from(table)` est enregistré avec la liste des méthodes
// chaînées (select, eq, upsert, ...). Au moment du `await`, le `handler` reçoit
// l'appel complet et décide du résultat { data, error } à renvoyer.
//
// Utilisation dans un test :
//   vi.mock('../lib/supabase', async () => {
//     const { fakeSupabase } = await import('../test/supabaseMock');
//     return { supabase: fakeSupabase };
//   });
//   import { supabaseMock } from '../test/supabaseMock';
//   supabaseMock.setHandler((call) => ({ data: [...], error: null }));

export interface QueryOperation {
  method: string;
  args: unknown[];
}

export interface QueryCall {
  table: string;
  operations: QueryOperation[];
}

export interface QueryResult {
  data: unknown;
  error: unknown;
}

export type QueryHandler = (call: QueryCall) => QueryResult;

const defaultHandler: QueryHandler = () => ({ data: null, error: null });

/** Indique si l'appel contient la méthode donnée (ex: 'upsert'). */
export function hasOperation(call: QueryCall, method: string): boolean {
  return call.operations.some((op) => op.method === method);
}

/** Arguments du premier appel à `method`, ou undefined. */
export function getOperationArgs(call: QueryCall, method: string): unknown[] | undefined {
  return call.operations.find((op) => op.method === method)?.args;
}

class SupabaseMockController {
  calls: QueryCall[] = [];
  private handler: QueryHandler = defaultHandler;

  setHandler(handler: QueryHandler) {
    this.handler = handler;
  }

  reset() {
    this.calls = [];
    this.handler = defaultHandler;
  }

  /** Appels filtrés par table (et éventuellement par méthode). */
  callsFor(table: string, method?: string): QueryCall[] {
    return this.calls.filter(
      (call) => call.table === table && (!method || hasOperation(call, method))
    );
  }

  resolve(call: QueryCall): QueryResult {
    return this.handler(call);
  }
}

export const supabaseMock = new SupabaseMockController();

function createQueryBuilder(call: QueryCall): unknown {
  const builder: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          // Rend le builder "awaitable", comme le vrai client Supabase
          return (onFulfilled?: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
            Promise.resolve()
              .then(() => supabaseMock.resolve(call))
              .then(onFulfilled, onRejected);
        }
        return (...args: unknown[]) => {
          call.operations.push({ method: String(prop), args });
          return builder;
        };
      },
    }
  );
  return builder;
}

export const fakeSupabase = {
  from(table: string) {
    const call: QueryCall = { table, operations: [] };
    supabaseMock.calls.push(call);
    return createQueryBuilder(call);
  },
};
