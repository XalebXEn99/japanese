export interface Point { x: number; y: number }
export function resample(points: Point[], count = 24): Point[] {
  if (!points.length) return [];
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const length = distances[distances.length - 1];
  if (length === 0) return Array.from({ length: count }, () => points[0]);
  let segment = 1;
  return Array.from({ length: count }, (_, i) => {
    const target = length * i / (count - 1);
    while (segment < distances.length - 1 && distances[segment] < target) segment++;
    const fraction = (target - distances[segment - 1]) / (distances[segment] - distances[segment - 1] || 1);
    return { x: points[segment - 1].x + fraction * (points[segment].x - points[segment - 1].x), y: points[segment - 1].y + fraction * (points[segment].y - points[segment - 1].y) };
  });
}
export function gradeHandwriting(drawn: Point[][], model: Point[][]): { score: number; feedback: string; passed: boolean } {
  if (!model.length) return { score: 0, passed: false, feedback: 'No stroke model is available for this character.' };
  if (drawn.length !== model.length) return { score: 0, passed: false, feedback: `Use ${model.length} strokes, in order. You drew ${drawn.length}.` };
  const scores = model.map((stroke, index) => {
    const actual = resample(drawn[index]), expected = resample(stroke);
    if (!actual.length || !expected.length) return 0;
    const error = actual.reduce((sum, p, i) => sum + Math.hypot(p.x - expected[i].x, p.y - expected[i].y), 0) / actual.length;
    return Math.max(0, 100 - error * 3);
  });
  const score = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  const weakest = scores.indexOf(Math.min(...scores)) + 1;
  const passed = score >= 65 && scores.every(s => s >= 45);
  return { score, passed, feedback: passed ? 'Good match. Keep practising shape and stroke direction.' : `Review stroke ${weakest}. Follow the model's position, shape, order and direction.` };
}
