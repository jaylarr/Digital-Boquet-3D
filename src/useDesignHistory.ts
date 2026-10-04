import { useCallback, useRef, useState } from 'react';
import { DesignHistory } from './designHistory';
import type { BouquetConfigV1 } from './config';
export function useDesignHistory(initial: BouquetConfigV1) {
  const ref = useRef<DesignHistory<BouquetConfigV1> | null>(null);
  if (!ref.current) ref.current = new DesignHistory(initial);
  const history = ref.current;
  const [, render] = useState(0);
  const setConfig = useCallback((next: BouquetConfigV1 | ((value: BouquetConfigV1) => BouquetConfigV1)) => { if (ref.current!.update(next)) render(n => n + 1); }, []);
  const beginEdit = useCallback(() => ref.current!.begin(), []);
  const endEdit = useCallback(() => ref.current!.end(), []);
  const undo = useCallback(() => { if (ref.current!.undo()) render(n => n + 1); }, []);
  const redo = useCallback(() => { if (ref.current!.redo()) render(n => n + 1); }, []);
  const replaceConfig = useCallback((value: BouquetConfigV1) => { ref.current!.replace(value); render(n => n + 1); }, []);
  return { config: history.current, setConfig, beginEdit, endEdit, undo, redo, replaceConfig, canUndo: !!history.past.length, canRedo: !!history.future.length };
}
