import { Point } from '../types';

/**
 * Checks if two line segments intersect.
 * Segment 1: p1 -> p2
 * Segment 2: p3 -> p4
 */
export const getLineIntersection = (p1: Point, p2: Point, p3: Point, p4: Point): boolean => {
  const det = (p2.x - p1.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p1.y);
  if (det === 0) {
    return false;
  } else {
    const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
    const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;
    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
  }
};

export const distance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const lerp = (start: number, end: number, t: number): number => {
  return start * (1 - t) + end * t;
};
