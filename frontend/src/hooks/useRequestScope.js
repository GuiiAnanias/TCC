import { useLayoutEffect, useMemo, useRef } from "react";

export function useRequestScope(context) {
  const scope = useMemo(() => {
    const requests = new Map();
    const cancel = (key) => {
      requests.get(key)?.abort();
      requests.delete(key);
    };
    return {
      owner: context,
      cancel,
      cancelAll() {
        for (const key of requests.keys()) cancel(key);
      },
      begin(key) {
        cancel(key);
        const controller = new AbortController();
        requests.set(key, controller);
        return {
          signal: controller.signal,
          isCurrent: () => requests.get(key) === controller && !controller.signal.aborted,
        };
      },
    };
  }, [context]);
  useLayoutEffect(() => () => scope.cancelAll(), [scope]);
  return scope;
}

export function useLatestValue(value) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
