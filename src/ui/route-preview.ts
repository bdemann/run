import {html, type HtmlInterpolation} from 'element-vir';
import {routeSvgPath} from '../data/gps.js';
import {type RoutePoint} from '../data/shapes.js';

/** A small outline of a route (no map). Nothing is drawn for fewer than two points. */
export function renderRoutePreview({
    points,
    size,
}: Readonly<{points: ReadonlyArray<Readonly<RoutePoint>>; size: number}>): HtmlInterpolation {
    const path = routeSvgPath(points, size);
    return path
        ? html`
              <svg
                  class="route-preview"
                  viewBox="0 0 ${size} ${size}"
                  width=${size}
                  height=${size}
                  role="img"
                  aria-label="Route outline"
              >
                  <polyline
                      points=${path}
                      fill="none"
                      stroke="var(--run-accent)"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                  />
              </svg>
          `
        : html``;
}
