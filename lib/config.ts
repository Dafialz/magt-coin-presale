export const SALE_WALLET = process.env.NEXT_PUBLIC_SALE_WALLET || "UQBDooPilphbndrSB1RdtkyZrnWctibsl356IvU7_jOxh4UT"; // твій адрес-одержувач TON
export const MAGT_DECIMALS = Number(process.env.NEXT_PUBLIC_MAGT_DECIMALS || "9");

// Реферал: query-параметр та % винагороди
export const REF_QUERY_PARAM = process.env.NEXT_PUBLIC_REF_PARAM || "ref";
export const REF_REWARD_PCT = 5; // 5%
export const REF_POOL_TOKENS = 25_000_000;
export const TOTAL_SUPPLY = 500_000_000;

// Продаж по рівнях
export type Level = { tokens: number; price: number }; // price = TON за 1 MAGT
export const LEVELS: Level[] = [
  { tokens: 65_225_022, price: 0.003734 },
  { tokens: 57_039_669, price: 0.004369 },
  { tokens: 50_370_908, price: 0.005112 },
  { tokens: 44_326_399, price: 0.005981 },
  { tokens: 39_007_231, price: 0.006998 },
  { tokens: 34_326_365, price: 0.008187 },
  { tokens: 30_207_200, price: 0.009578 },
  { tokens: 26_582_336, price: 0.011207 },
  { tokens: 23_392_455, price: 0.013112 },
  { tokens: 20_585_361, price: 0.015342 },
  { tokens: 18_115_117, price: 0.01795 },
  { tokens: 15_941_303, price: 0.021001 },
  { tokens: 14_028_347, price: 0.024571 },
  { tokens: 12_344_945, price: 0.028748 },
  { tokens: 10_863_552, price: 0.033636 },
  { tokens: 9_559_925,  price: 0.039353 },
  { tokens: 8_412_734,  price: 0.046043 },
  { tokens: 7_423_267,  price: 0.053871 },
  { tokens: 6_514_821,  price: 0.063029 },
  { tokens: 5_733_043,  price: 0.073579 },
];
