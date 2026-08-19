import { getBenchmarkQueries } from "../server/rag/indexStore";

const queries = await getBenchmarkQueries(60);
console.log(JSON.stringify(queries.map((query, index) => ({
  position: index + 1,
  raw: query,
  length: query.length,
  codePoints: Array.from(query).map(character => character.codePointAt(0)?.toString(16)),
})), null, 2));
