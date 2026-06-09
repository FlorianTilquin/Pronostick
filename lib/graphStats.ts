import { bookmakerOddsByMatchId } from "@/lib/bookmakerOdds";
import { getPredictions, getUsers } from "@/lib/db";
import type { Prediction } from "@/lib/types";

export type RidgeOddsRow = {
  name: string;
  values: number[];
  average: number | null;
  highRiskShare: number;
};

export type MdsPoint = {
  name: string;
  x: number;
  y: number;
  averageDistance: number;
  predictions: number;
};

function predictionOutcome(prediction: Pick<Prediction, "home_score" | "away_score">) {
  if (prediction.home_score > prediction.away_score) return "H";
  if (prediction.home_score < prediction.away_score) return "A";
  return "D";
}

function oddsForPrediction(prediction: Prediction, market: ReturnType<typeof bookmakerOddsByMatchId> extends Map<number, infer T> ? T : never) {
  const outcome = predictionOutcome(prediction);
  if (outcome === "H") return market.home_odds;
  if (outcome === "A") return market.away_odds;
  return market.draw_odds;
}

function perMatchDistance(a: Prediction, b: Prediction) {
  const outcomePenalty = predictionOutcome(a) === predictionOutcome(b) ? 0 : 1;
  const scoreDistance = Math.min(6, Math.abs(a.home_score - b.home_score) + Math.abs(a.away_score - b.away_score)) / 6;
  return 0.68 * outcomePenalty + 0.32 * scoreDistance;
}

function pairDistance(a: Prediction[], b: Prediction[]) {
  const bByMatch = new Map(b.map((prediction) => [prediction.match_id, prediction]));
  const distances = a
    .map((prediction) => {
      const other = bByMatch.get(prediction.match_id);
      return other ? perMatchDistance(prediction, other) : null;
    })
    .filter((value): value is number => value !== null);

  if (!distances.length) return 1;
  return distances.reduce((sum, value) => sum + value, 0) / distances.length;
}

function jacobiEigen(matrix: number[][]) {
  const n = matrix.length;
  const a = matrix.map((row) => [...row]);
  const vectors: number[][] = Array.from({ length: n }, (_, row) => Array.from({ length: n }, (_unused, col) => (row === col ? 1 : 0)));

  for (let iteration = 0; iteration < 80; iteration += 1) {
    let p = 0;
    let q = 1;
    let max = 0;
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const value = Math.abs(a[i]?.[j] ?? 0);
        if (value > max) {
          max = value;
          p = i;
          q = j;
        }
      }
    }
    if (max < 1e-10) break;

    const app = a[p]?.[p] ?? 0;
    const aqq = a[q]?.[q] ?? 0;
    const apq = a[p]?.[q] ?? 0;
    const angle = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    for (let i = 0; i < n; i += 1) {
      const aip = a[i]?.[p] ?? 0;
      const aiq = a[i]?.[q] ?? 0;
      a[i]![p] = c * aip - s * aiq;
      a[i]![q] = s * aip + c * aiq;
    }
    for (let j = 0; j < n; j += 1) {
      const apj = a[p]?.[j] ?? 0;
      const aqj = a[q]?.[j] ?? 0;
      a[p]![j] = c * apj - s * aqj;
      a[q]![j] = s * apj + c * aqj;
    }
    a[p]![q] = 0;
    a[q]![p] = 0;

    for (let i = 0; i < n; i += 1) {
      const vip = vectors[i]?.[p] ?? 0;
      const viq = vectors[i]?.[q] ?? 0;
      vectors[i]![p] = c * vip - s * viq;
      vectors[i]![q] = s * vip + c * viq;
    }
  }

  return Array.from({ length: n }, (_, index) => ({
    value: a[index]?.[index] ?? 0,
    vector: vectors.map((row) => row[index] ?? 0)
  })).sort((left, right) => right.value - left.value);
}

function classicalMds(distances: number[][]) {
  const n = distances.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: 0, y: 0 }];

  const squared = distances.map((row) => row.map((value) => value * value));
  const rowMeans = squared.map((row) => row.reduce((sum, value) => sum + value, 0) / n);
  const colMeans = Array.from({ length: n }, (_, col) => squared.reduce((sum, row) => sum + (row[col] ?? 0), 0) / n);
  const totalMean = rowMeans.reduce((sum, value) => sum + value, 0) / n;
  const centered = squared.map((row, i) => row.map((value, j) => -0.5 * (value - rowMeans[i]! - colMeans[j]! + totalMean)));
  const eigen = jacobiEigen(centered);
  const first = eigen[0];
  const second = eigen[1];

  return Array.from({ length: n }, (_, index) => ({
    x: first && first.value > 0 ? first.vector[index]! * Math.sqrt(first.value) : 0,
    y: second && second.value > 0 ? second.vector[index]! * Math.sqrt(second.value) : 0
  }));
}

export function predictionOddsDistribution(): RidgeOddsRow[] {
  const users = getUsers().filter((user) => user.role === "player");
  const predictions = getPredictions();
  const markets = bookmakerOddsByMatchId();

  return users.map((user) => {
    const values = predictions
      .filter((prediction) => prediction.user_id === user.id)
      .map((prediction) => {
        const market = markets.get(prediction.match_id);
        return market ? oddsForPrediction(prediction, market) : null;
      })
      .filter((value): value is number => value !== null && Number.isFinite(value))
      .sort((a, b) => a - b);

    return {
      name: user.display_name,
      values,
      average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      highRiskShare: values.length ? values.filter((value) => value >= 4).length / values.length : 0
    };
  });
}

export function predictionMdsProjection(): MdsPoint[] {
  const users = getUsers().filter((user) => user.role === "player");
  const allPredictions = getPredictions();
  const predictionsByUser = users.map((user) => allPredictions.filter((prediction) => prediction.user_id === user.id));
  const distances = users.map((_user, i) =>
    users.map((_other, j) => {
      if (i === j) return 0;
      return pairDistance(predictionsByUser[i] ?? [], predictionsByUser[j] ?? []);
    })
  );
  const coordinates = classicalMds(distances);

  return users.map((user, index) => {
    const row = distances[index] ?? [];
    const averageDistance = row.length > 1 ? row.reduce((sum, value) => sum + value, 0) / (row.length - 1) : 0;
    return {
      name: user.display_name,
      x: coordinates[index]?.x ?? 0,
      y: coordinates[index]?.y ?? 0,
      averageDistance,
      predictions: predictionsByUser[index]?.length ?? 0
    };
  });
}
