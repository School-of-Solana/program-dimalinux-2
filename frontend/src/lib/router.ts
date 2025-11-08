import { writable, get } from "svelte/store";

export interface Route {
  path: string; // canonical path (/, /create, /raffle/<pda>)
  segments: string[];
  params: Record<string, string>; // includes pda and query params like tab
}

const routeStore = writable<Route>({ path: "/", segments: [], params: {} });

function parseHash(): Route {
  const rawHash = window.location.hash.replace(/^#/, "");
  const hash = rawHash === "" ? "/" : rawHash;
  const [pathPart, queryPart] = hash.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const params: Record<string, string> = {};

  if (queryPart) {
    for (const kv of queryPart.split("&")) {
      if (!kv) {
        continue;
      }
      const [k, v] = kv.split("=");
      if (k) {
        params[decodeURIComponent(k)] = decodeURIComponent(v || "");
      }
    }
  }

  if (segments.length === 0) {
    return { path: "/", segments: [], params };
  }
  if (segments.length === 1 && segments[0] === "create") {
    return { path: "/create", segments: ["create"], params };
  }
  if (segments.length === 2 && segments[0] === "raffle") {
    params.pda = segments[1];
    return { path: "/raffle/" + segments[1], segments: ["raffle", segments[1]], params };
  }
  // Unknown path -> not found (App will handle)
  return { path: "/" + segments.join("/"), segments, params };
}

export const currentRoute = routeStore;

export function navigate(to: string) {
  const target = to.startsWith("/") ? "#" + to : to.startsWith("#") ? to : "#/" + to;
  window.location.hash = target;
}

export function initRouter() {
  function update() {
    routeStore.set(parseHash());
  }
  window.addEventListener("hashchange", update);
  update();
}

export function getRoute() {
  return get(routeStore);
}
