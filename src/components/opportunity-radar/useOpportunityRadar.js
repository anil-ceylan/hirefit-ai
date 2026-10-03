import { useCallback, useEffect, useRef, useState } from "react";
import { listOpportunities, updateOpportunityState } from "../../utils/opportunityRadarClient.js";
import { isVisibleJob } from "../../../lib/opportunityRadar/validation.js";

export function useOpportunityRadar({ getApiAuthHeaders, lang, filter = "all", limit = 20 }) {
  const [data, setData] = useState({ status: "loading", items: [], meta: null });
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [version, setVersion] = useState(0);
  const epoch = useRef(0);
  const writing = useRef(null);
  const lock = useRef(false);
  useEffect(() => {
    const generation = ++epoch.current;
    const controller = new AbortController();
    setData({ status: "loading", items: [], meta: null });
    setNotice(null);
    setBusy(null);
    lock.current = false;
    listOpportunities(getApiAuthHeaders, { lang, filter, limit, signal: controller.signal })
      .then(result => { if (epoch.current === generation) setData({ status: "ready", items: result.opportunities, meta: result.meta }); })
      .catch(error => { if (epoch.current === generation && error.code !== "CANCELLED") setData({ status: error.code === "CAREER_PROFILE_REQUIRED" ? "profile_required" : "error", error, items: [] }); });
    return () => { epoch.current = generation + 1; controller.abort(); writing.current?.abort(); };
  }, [getApiAuthHeaders, lang, filter, limit, version]);
  // Recheck expiry while the page is open, not only on its initial request.
  useEffect(() => {
    const prune = () => setData(current => current.status === "ready" ? { ...current, items: current.items.filter(item => isVisibleJob(item)) } : current);
    const timer = setInterval(prune, 30000);
    window.addEventListener("focus", prune);
    return () => { clearInterval(timer); window.removeEventListener("focus", prune); };
  }, []);
  const reload = useCallback(() => { if (!lock.current) setVersion(value => value + 1); }, []);
  const update = async (id, state) => {
    if (lock.current) return;
    lock.current = true;
    const generation = epoch.current;
    const controller = new AbortController();
    writing.current = controller;
    setBusy(id);
    setNotice(null);
    try {
      await updateOpportunityState(getApiAuthHeaders, id, state, { signal: controller.signal });
      if (generation !== epoch.current) return;
      // Deliberately pessimistic: never remove/mark a card before acknowledgement.
      setData(current => ({ ...current, items: current.items
        .map(item => item.id === id ? { ...item, current_user_state: state } : item)
        .filter(item => item.current_user_state !== "dismissed" && isVisibleJob(item)) }));
      setNotice({ state });
    } catch (error) {
      if (generation === epoch.current && error.code !== "CANCELLED") setNotice({ error });
    } finally {
      if (generation === epoch.current) { lock.current = false; writing.current = null; setBusy(null); }
    }
  };
  return { ...data, busy, notice, reload, update };
}
