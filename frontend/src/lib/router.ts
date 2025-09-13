import { writable, get } from "svelte/store";

export interface Route {
  path: string; // e.g. '/create', '/view/:pda'
  segments: string[];
  params: Record<string, string>;
}

const routeStore = writable<Route>({ path: "/", segments: [], params: {} });

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  const raw = hash.startsWith("/") ? hash : "/" + hash;
  const segments = raw.split("/").filter(Boolean);
  let params: Record<string, string> = {};
  // Patterns we care about: /create, /view/<pda>, /manage/<pda>, /buy/<pda>
  if (
    segments.length === 2 &&
    ["view", "manage", "buy"].includes(segments[0])
  ) {
    params.pda = segments[1];
  }
  return { path: "/" + segments.join("/"), segments, params };
}

export const currentRoute = routeStore;

export function navigate(to: string) {
  if (!to.startsWith("#")) {
    window.location.hash = to.startsWith("/") ? "#" + to : "#/" + to;
  } else {
    window.location.hash = to;
  }
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
