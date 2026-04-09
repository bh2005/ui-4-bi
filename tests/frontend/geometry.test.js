/**
 * Tests für js/utils/geometry.js
 *   - snapToGrid (snap ein/aus, verschiedene Größen)
 *   - bezierPoint (kubische Bézier-Kurve)
 *   - getPortPoint (Port-Positionen)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── state.js mocken (hat DOM-Refs die in Node nicht existieren) ────────────
vi.mock('../../src/js/core/state.js', () => ({
  state: { snap: true, snapGrid: 20 },
}));

import { snapToGrid, bezierPoint, getPortPoint, getEdgePointToTarget, getEdgePoint } from '../../src/js/utils/geometry.js';
import { state } from '../../src/js/core/state.js';


describe('snapToGrid', () => {
  beforeEach(() => {
    state.snap     = true;
    state.snapGrid = 20;
  });

  it('rundet auf 20px-Raster auf', () => {
    expect(snapToGrid(23)).toBe(20);  // 23 < 30 (Mitte) → bleibt bei 20
    expect(snapToGrid(31)).toBe(40);  // 31 > 30 (Mitte) → nächster Gitterpunkt 40
    expect(snapToGrid(40)).toBe(40);
  });

  it('rundet auf 20px-Raster ab', () => {
    expect(snapToGrid(0)).toBe(0);
    expect(snapToGrid(9)).toBe(0);    // 9 < 10 (Mitte von 0→20) → 0
    expect(snapToGrid(11)).toBe(20);  // 11 > 10 (Mitte) → 20
  });

  it('gibt Rohwert zurück wenn snap=false', () => {
    state.snap = false;
    expect(snapToGrid(23)).toBe(23);
    expect(snapToGrid(1)).toBe(1);
  });

  it('respektiert snapGrid=10', () => {
    state.snapGrid = 10;
    expect(snapToGrid(14)).toBe(10);
    expect(snapToGrid(16)).toBe(20);
  });

  it('respektiert snapGrid=40', () => {
    state.snapGrid = 40;
    expect(snapToGrid(19)).toBe(0);
    expect(snapToGrid(21)).toBe(40);
  });

  it('respektiert snapGrid=80', () => {
    state.snapGrid = 80;
    expect(snapToGrid(79)).toBe(80);
    expect(snapToGrid(39)).toBe(0);
  });

  it('funktioniert mit negativen Werten', () => {
    expect(snapToGrid(-10)).toBe(0);   // Math.round(-0.5) = 0
    expect(snapToGrid(-11)).toBe(-20);
  });
});


describe('bezierPoint', () => {
  const p0 = { x: 0,   y: 0   };
  const p1 = { x: 100, y: 0   };
  const p2 = { x: 100, y: 100 };
  const p3 = { x: 200, y: 100 };

  it('t=0 gibt Startpunkt zurück', () => {
    const pt = bezierPoint(0, p0, p1, p2, p3);
    expect(pt.x).toBeCloseTo(0);
    expect(pt.y).toBeCloseTo(0);
  });

  it('t=1 gibt Endpunkt zurück', () => {
    const pt = bezierPoint(1, p0, p1, p2, p3);
    expect(pt.x).toBeCloseTo(200);
    expect(pt.y).toBeCloseTo(100);
  });

  it('t=0.5 liegt zwischen Start und Ende', () => {
    const pt = bezierPoint(0.5, p0, p1, p2, p3);
    expect(pt.x).toBeGreaterThan(0);
    expect(pt.x).toBeLessThan(200);
  });

  it('gerade Linie (alle Kontrollpunkte auf X-Achse)', () => {
    const a = { x: 0, y: 0 }, b = { x: 50, y: 0 }, c = { x: 150, y: 0 }, d = { x: 200, y: 0 };
    expect(bezierPoint(0.5, a, b, c, d).y).toBeCloseTo(0);
    expect(bezierPoint(0.5, a, b, c, d).x).toBeCloseTo(100);
  });

  it('symmetrische Kurve: t=0.5 liegt in der Mitte', () => {
    const a = { x: 0, y: 0 }, b = { x: 0, y: 100 }, c = { x: 100, y: 100 }, d = { x: 100, y: 0 };
    const mid = bezierPoint(0.5, a, b, c, d);
    expect(mid.x).toBeCloseTo(50);
    expect(mid.y).toBeCloseTo(75);
  });
});


describe('getPortPoint', () => {
  const node = { x: 100, y: 200 };
  // getPortPoint ruft getNodeSize auf → braucht DOM-Mock
  // Da kein DOM da ist, gibt getNodeSize Fallback (140x50)

  it('top: horizontal zentriert, y=node.y', () => {
    const pt = getPortPoint(node, 'top');
    expect(pt.x).toBeCloseTo(100 + 140 / 2);
    expect(pt.y).toBe(200);
  });

  it('bottom: horizontal zentriert, y=node.y+h', () => {
    const pt = getPortPoint(node, 'bottom');
    expect(pt.y).toBe(250);
  });

  it('left: x=node.x, vertikal zentriert', () => {
    const pt = getPortPoint(node, 'left');
    expect(pt.x).toBe(100);
    expect(pt.y).toBeCloseTo(200 + 50 / 2);
  });

  it('right: x=node.x+w, vertikal zentriert', () => {
    const pt = getPortPoint(node, 'right');
    expect(pt.x).toBe(240);
    expect(pt.y).toBeCloseTo(225);
  });

  it('unbekannter Port gibt Mittelpunkt zurück', () => {
    const pt = getPortPoint(node, 'center');
    expect(pt.x).toBeCloseTo(170);
    expect(pt.y).toBeCloseTo(225);
  });
});


// Fallback-Größe: getNodeSize → { w:140, h:50 } wenn kein DOM-Element vorhanden
// node = { x:100, y:200 } → center = { cx:170, cy:225 }

describe('getEdgePointToTarget', () => {
  const node = { x: 100, y: 200, id: 'n1' };

  it('fast identischer Punkt → unterer Mittelpunkt', () => {
    const pt = getEdgePointToTarget(node, 170, 225.0001);
    expect(pt.x).toBeCloseTo(170);
    expect(pt.y).toBe(250); // node.y + nh
  });

  it('Ziel rechts (|dx|>|dy|) → rechte Kante', () => {
    const pt = getEdgePointToTarget(node, 400, 225); // dx=230, dy=0
    expect(pt.x).toBe(240); // node.x + nw
    expect(pt.y).toBeCloseTo(225);
  });

  it('Ziel links (|dx|>|dy|) → linke Kante', () => {
    const pt = getEdgePointToTarget(node, 0, 225); // dx=-170, dy=0
    expect(pt.x).toBe(100); // node.x
    expect(pt.y).toBeCloseTo(225);
  });

  it('Ziel unten (|dy|>|dx|) → untere Kante', () => {
    const pt = getEdgePointToTarget(node, 170, 400); // dx=0, dy=175
    expect(pt.y).toBe(250); // node.y + nh
    expect(pt.x).toBeCloseTo(170);
  });

  it('Ziel oben (|dy|>|dx|) → obere Kante', () => {
    const pt = getEdgePointToTarget(node, 170, 50); // dx=0, dy=-175
    expect(pt.y).toBe(200); // node.y
    expect(pt.x).toBeCloseTo(170);
  });

  it('diagonaler Schnittpunkt wird auf Kante begrenzt', () => {
    const pt = getEdgePointToTarget(node, 500, 500);
    expect(pt.x).toBeGreaterThanOrEqual(100);
    expect(pt.x).toBeLessThanOrEqual(240);
    expect(pt.y).toBeGreaterThanOrEqual(200);
    expect(pt.y).toBeLessThanOrEqual(250);
  });
});


describe('getEdgePoint', () => {
  const nodeA = { x: 100, y: 200, id: 'a' };
  const nodeB = { x: 300, y: 200, id: 'b' };

  it('gibt Punkt auf der Kante von nodeA in Richtung Zentrum nodeB zurück', () => {
    const pt = getEdgePoint(nodeA, nodeB);
    // nodeB-Zentrum bei (370, 225) → nodeA rechte Kante
    expect(pt.x).toBe(240);
    expect(pt.y).toBeCloseTo(225);
  });

  it('Knoten übereinander → Punkt auf unterer Kante', () => {
    const above = { x: 100, y: 50,  id: 'u' };
    const below = { x: 100, y: 200, id: 'v' };
    const pt = getEdgePoint(above, below);
    expect(pt.y).toBe(100); // above.y + nh
  });
});
