import { REF_QUERY_PARAM } from "./config";

// ключі у localStorage
const LS_REF_CODE = "magt_ref";
const LS_REF_BOUND = "magt_ref_bound_to"; // адрес юзера, для якого забінджено рефа

export function readRefFromUrlOrStorage(): string {
  if (typeof window === "undefined") return "";
  try {
    const url = new URL(window.location.href);
    const q = (url.searchParams.get(REF_QUERY_PARAM) || "").trim();
    if (q) {
      localStorage.setItem(LS_REF_CODE, q);
      return q;
    }
    return localStorage.getItem(LS_REF_CODE) || "";
  } catch {
    return localStorage.getItem(LS_REF_CODE) || "";
  }
}

// після конекту: якщо є ?ref= і ще не забінджено — "прикріплюємо назавжди"
export function bindReferrerIfNeeded(userAddress: string) {
  if (typeof window === "undefined") return;
  const ref = localStorage.getItem(LS_REF_CODE);
  const boundTo = localStorage.getItem(LS_REF_BOUND);

  if (ref && !boundTo) {
    localStorage.setItem(LS_REF_BOUND, userAddress);
  }
}

// чи забінджений уже реферер для цього юзера
export function getBoundReferrerFor(userAddress: string): string {
  if (typeof window === "undefined") return "";
  const boundTo = localStorage.getItem(LS_REF_BOUND);
  if (boundTo && boundTo === userAddress) {
    return localStorage.getItem(LS_REF_CODE) || "";
  }
  return "";
}

// побудувати реф-посилання користувача
export function buildMyRefLink(myAddress: string): string {
  if (typeof window === "undefined") return "";
  const origin = window.location.origin;
  return `${origin}/?${REF_QUERY_PARAM}=${encodeURIComponent(myAddress)}`;
}
