import {
  Address,
  beginCell,
  Cell,
  contractAddress,
  Contract,
  ContractProvider,
  Sender,
  toNano,
} from "ton-core";

export type ClaimManagerConfig = {
  owner: Address;
  jettonMaster: Address;
};

export function claimManagerConfigToCell(config: ClaimManagerConfig): Cell {
  return beginCell()
    .storeAddress(config.owner)
    .storeAddress(config.jettonMaster)
    .storeDict(null) // alloc map init (зберігається в контракті; тут лишаємо порожнє)
    .endCell();
}

// OPCODES
export const OP_ADMIN_SET = 0x0ac10a11;
export const OP_USER_CLAIM = 0xc1a10001;
export const OP_BUY = 0x42555931; // 'BUY1'

export class ClaimManager implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromConfig(config: ClaimManagerConfig, code: Cell, workchain = 0) {
    const data = claimManagerConfigToCell(config);
    const init = { code, data };
    return new ClaimManager(contractAddress(workchain, init), init);
  }

  // === getters ===
  async getOwner(provider: ContractProvider) {
    const res = await provider.get("get_owner", []);
    return res.stack.readAddress();
  }

  async getJettonMaster(provider: ContractProvider) {
    const res = await provider.get("get_jetton_master", []);
    return res.stack.readAddress();
  }

  async getAlloc(provider: ContractProvider, user: Address) {
    const res = await provider.get("get_alloc", [
      { type: "slice", cell: beginCell().storeAddress(user).endCell() },
    ]);
    return res.stack.readBigNumber(); // bigint у мін. одиницях
  }

  // === owner: set allocation ===
  async sendAdminSet(provider: ContractProvider, via: Sender, user: Address, amountMinUnits: bigint) {
    const body = beginCell()
      .storeUint(OP_ADMIN_SET, 32)
      .storeAddress(user)
      .storeInt(amountMinUnits, 257)
      .endCell();

    await provider.internal(via, { value: toNano("0.05"), body });
  }

  // === user: claim ===
  async sendUserClaim(provider: ContractProvider, via: Sender) {
    const body = beginCell().storeUint(OP_USER_CLAIM, 32).endCell();
    await provider.internal(via, { value: toNano("0.05"), body });
  }

  // === user: buy (платіж на контракт з payload 'BUY1 [+ maybe ref]') ===
  // УВАГА: це запрацює тільки після того, як у смарт-контракті з’явиться обробка OP_BUY з jetton transfer.
  async sendUserBuy(
    provider: ContractProvider,
    via: Sender,
    amountTon: string, // наприклад "0.30"
    ref?: Address | null
  ) {
    const body = beginCell().storeUint(OP_BUY, 32).storeAddress(ref ?? null).endCell();
    await provider.internal(via, { value: toNano(amountTon), body });
  }
}
