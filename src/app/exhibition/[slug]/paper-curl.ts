// An inextensible cylindrical ribbon: integrate local tangents instead of rotating
// one rigid rectangle. The binding is always (0, 0); each segment keeps its length.
// No third-party code/runtime or WebGL context is required.
export function paperCurl(progress: number, segments = 48) {
  const p = Math.max(0, Math.min(1, progress));
  const bend = .95 * Math.sin(Math.PI * p);
  let x = 0, z = 0;
  return Array.from({ length: segments }, (_, i) => {
    const angle = Math.PI * p - bend * Math.cos(Math.PI * (i + .5) / segments);
    const nextX = x + Math.cos(angle) / segments;
    const nextZ = z - Math.sin(angle) / segments;
    const strip = { x, z, nextX, nextZ, angle, u: i / segments, length: 1 / segments };
    x = nextX; z = nextZ;
    return strip;
  });
}
