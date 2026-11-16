"use client";

import { useSyncExternalStore } from "react";

export const MESA_STORAGE_KEY = "gr-cliente-mesa-id";
const STORAGE_EVENT = "gr-cliente-mesa-change";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORAGE_EVENT, onStoreChange);
  };
}

function getSnapshot(): string | null {
  return window.localStorage.getItem(MESA_STORAGE_KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

export function useMesaGuardada(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setMesaGuardada(mesaId: string | null): void {
  if (mesaId) {
    window.localStorage.setItem(MESA_STORAGE_KEY, mesaId);
  } else {
    window.localStorage.removeItem(MESA_STORAGE_KEY);
  }
  window.dispatchEvent(new Event(STORAGE_EVENT));
}
