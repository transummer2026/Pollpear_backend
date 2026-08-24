export function canonicalPair(a: number, b: number) {
  return { userAId: Math.min(a, b), userBId: Math.max(a, b) };
}
