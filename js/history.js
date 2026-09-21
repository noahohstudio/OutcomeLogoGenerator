// Undo / redo over whole-design snapshots.
// record(key) is called *before* a change. Calls with the same key within COALESCE_MS collapse into one step
// (a slider drag, a run of arrow-key nudges); record(null) always makes its own step (a shuffle, a reset).

const COALESCE_MS = 700;

export function createHistory({ snapshot, restore, limit = 100, onChange = () => {} }) {
  let past = [], future = [], lastKey = null, lastTime = 0;

  const notify = () => onChange({ canUndo: past.length > 0, canRedo: future.length > 0 });

  return {
    record(key = null) {
      const now = performance.now();
      if (key && key === lastKey && now - lastTime < COALESCE_MS) { lastTime = now; return; }
      past.push(snapshot());
      if (past.length > limit) past.shift();
      future = [];
      lastKey = key; lastTime = now;
      notify();
    },
    undo() {
      if (!past.length) return false;
      future.push(snapshot());
      restore(past.pop());
      lastKey = null;
      notify();
      return true;
    },
    redo() {
      if (!future.length) return false;
      past.push(snapshot());
      restore(future.pop());
      lastKey = null;
      notify();
      return true;
    },
    notify,
  };
}
