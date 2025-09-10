// app/api/alloc/route.ts
import { NextRequest, NextResponse } from "next/server";
import { TonClient } from "ton";
import { getHttpEndpoint } from "@orbs-network/ton-access";
import { Address, beginCell } from "ton-core";

// щоб Next не кешував відповідь під час деву
export const dynamic = "force-dynamic"; // Next 13/14/15 App Router
export const revalidate = 0;

// === ENV ===
// В .env.local мають бути:
// NEXT_PUBLIC_CLAIM_ADDRESS=EQ...     (або CLAIM_ADDRESS=EQ...)
// NEXT_PUBLIC_MAGT_DECIMALS=9         (або MAGT_DECIMALS=9)
// NETWORK=mainnet | testnet
const CLAIM_ADDRESS =
  process.env.NEXT_PUBLIC_CLAIM_ADDRESS ??
  process.env.CLAIM_ADDRESS ??
  "";

const DECIMALS =
  Number(process.env.NEXT_PUBLIC_MAGT_DECIMALS ?? process.env.MAGT_DECIMALS ?? "9") || 9;

const NETWORK = (process.env.NETWORK ?? "mainnet") as "mainnet" | "testnet";

// простий humanizer для bigint → рядок з десятковою крапкою
function humanize(units: bigint, decimals: number) {
  const base = 10n ** BigInt(decimals);
  const int = units / base;
  const fracRaw = (units % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracRaw ? `${int}.${fracRaw}` : `${int}`;
}

export async function GET(req: NextRequest) {
  try {
    // 0) валідність ENV
    if (!CLAIM_ADDRESS) {
      return NextResponse.json(
        { error: "CLAIM_ADDRESS is not set in env" },
        { status: 500 }
      );
    }

    // 1) дістаємо user з query
    const userParam = req.nextUrl.searchParams.get("user");
    if (!userParam) {
      return NextResponse.json({ error: "user is required" }, { status: 400 });
    }

    let user: Address;
    let contract: Address;
    try {
      user = Address.parse(userParam);
    } catch {
      return NextResponse.json(
        { error: "user address is invalid" },
        { status: 400 }
      );
    }
    try {
      contract = Address.parse(CLAIM_ADDRESS);
    } catch {
      return NextResponse.json(
        { error: "CLAIM_ADDRESS in env is invalid" },
        { status: 500 }
      );
    }

    // 2) клієнт
    const endpoint = await getHttpEndpoint({ network: NETWORK });
    const client = new TonClient({ endpoint });

    // 3) виклик get_alloc(user)
    const res = await client.callGetMethod(contract, "get_alloc", [
      { type: "slice", cell: beginCell().storeAddress(user).endCell() },
    ]);

    const raw = res.stack.readBigNumber(); // bigint
    const human = humanize(raw, DECIMALS);

    // 4) відповідь
    return NextResponse.json({
      raw: raw.toString(),
      human,
      // нижче — дрібний дебаг, лишаю корисним під час інтеграції
      // при бажанні можеш прибрати ці поля
      _debug: {
        contract: contract.toString(),
        network: NETWORK,
        user: user.toString(),
        decimals: DECIMALS,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
