import { Address, beginCell, Cell, contractAddress, Contract, ContractProvider, Sender, toNano } from "ton-core";

export type ClaimManagerConfig = {
  owner: Address;
  jettonMaster: Address;
};

export function claimManagerConfigToCell(config: ClaimManagerConfig): Cell {
  return beginCell()
    .storeAddress(config.owner)
    .storeAddress(config.jettonMaster)
    .storeDict(null) // alloc map init (порожня) — у Tact це у сховищі, тут не пакуємо
    .endCell();
}

export class ClaimManager implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromConfig(config: ClaimManagerConfig, code: Cell, workchain = 0) {
    const data = claimManagerConfigToCell(config);
    const init = { code, data };
    return new ClaimManager(contractAddress(workchain, init), init);
  }

  // getters
  async getOwner(provider: ContractProvider) {
    const res = await provider.get("get_owner", []);
    return res.stack.readAddress();
  }

  async getJettonMaster(provider: ContractProvider) {
    const res = await provider.get("get_jetton_master", []);
    return res.stack.readAddress();
  }

  async getAlloc(provider: ContractProvider, user: Address) {
    const res = await provider.get("get_alloc", [{ type: "slice", cell: beginCell().storeAddress(user).endCell() }]);
    return res.stack.readBigNumber(); // в мін. юнітах
  }

  // owner: set allocation
  async sendAdminSet(provider: ContractProvider, via: Sender, user: Address, amountMinUnits: bigint) {
    const body = beginCell()
      .storeUint(0xAC10A11, 32) // OP_ADMIN_SET
      .storeAddress(user)
      .storeInt(amountMinUnits, 257)
      .endCell();

    await provider.internal(via, { value: toNano("0.05"), body });
  }

  // user: claim
  async sendUserClaim(provider: ContractProvider, via: Sender) {
    const body = beginCell().storeUint(0xC1A10001, 32).endCell();
    await provider.internal(via, { value: toNano("0.05"), body });
  }
}
