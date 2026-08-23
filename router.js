// A small, dependency-free router. Supports path params like /projects/:id
// and matches methods exactly. Good enough for an MVP API without pulling in Express.

function compilePath(pattern) {
  const paramNames = [];
  const regexStr = pattern
    .replace(/\/+$/, '') // strip trailing slash
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { regex: new RegExp(`^${regexStr || '/'}$`), paramNames };
}

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    const { regex, paramNames } = compilePath(pattern);
    this.routes.push({ method, regex, paramNames, handler });
    return this;
  }

  get(pattern, handler) { return this.add('GET', pattern, handler); }
  post(pattern, handler) { return this.add('POST', pattern, handler); }
  put(pattern, handler) { return this.add('PUT', pattern, handler); }
  patch(pattern, handler) { return this.add('PATCH', pattern, handler); }
  delete(pattern, handler) { return this.add('DELETE', pattern, handler); }

  /** Returns { handler, params } or null if no route matches. */
  match(method, pathname) {
    const cleanPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = route.regex.exec(cleanPath);
      if (!m) continue;
      const params = {};
      route.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1]); });
      return { handler: route.handler, params };
    }
    return null;
  }
}
