import { useEffect, useRef } from "react";
import { STAMPS_PER_CARD } from "../logic/loyalty.js";

// Ten circles. A stamp that was just added gets a one-time "pop".
export default function StampProgress({ count }) {
  const previous = useRef(count);
  useEffect(() => {
    previous.current = count;
  }, [count]);
  const from = previous.current;

  return (
    <ol className="stamps" aria-label={`${count} of ${STAMPS_PER_CARD} cups collected`}>
      {Array.from({ length: STAMPS_PER_CARD }, (_, i) => {
        const on = i < count;
        const fresh = on && (count < from ? true : i >= from);
        const last = i === STAMPS_PER_CARD - 1;
        return (
          <li key={i} className={`stamp${on ? " stamp--on" : ""}${fresh ? " stamp--new" : ""}`}>
            {on ? "✓" : last ? "free" : ""}
          </li>
        );
      })}
    </ol>
  );
}
