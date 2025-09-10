import { LEVELS, Level } from "./config";

// скільки MAGT купимо на sumTon, якщо вже продано soldSoFar (MAGT)
export function estimateMagtByTon(sumTon: number, soldSoFar: number, levels: Level[] = LEVELS) {
  let tonLeft = sumTon;
  let magtOut = 0;
  let sold = soldSoFar;

  for (const lv of levels) {
    const alreadyInThisLevel = Math.min(Math.max(sold, 0), lv.tokens);
    const remainingInLevel = lv.tokens - alreadyInThisLevel;
    if (remainingInLevel <= 0) {
      sold -= lv.tokens; // рухаємося далі
      continue;
    }

    const maxBuyHere = tonLeft / lv.price; // MAGT за поточним рівнем
    const take = Math.min(remainingInLevel, Math.floor(maxBuyHere));

    if (take > 0) {
      magtOut += take;
      tonLeft -= take * lv.price;
    }

    sold = Math.max(0, sold - lv.tokens + take);
    if (tonLeft <= 1e-12) break;
  }

  return { magtOut, tonLeft };
}

// повертає інфу по поточному рівню за soldSoFar
export function currentLevelInfo(soldSoFar: number, levels: Level[] = LEVELS) {
  let acc = 0;
  for (let i = 0; i < levels.length; i++) {
    acc += levels[i].tokens;
    if (soldSoFar < acc) {
      const usedInLevel = levels[i].tokens - (acc - soldSoFar);
      const left = levels[i].tokens - usedInLevel;
      return { index: i + 1, price: levels[i].price, leftInLevel: left };
    }
  }
  return { index: levels.length, price: levels[levels.length - 1].price, leftInLevel: 0 };
}
