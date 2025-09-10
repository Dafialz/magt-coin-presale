// ClaimManager.tact
// Простий клейм: owner задає алокації (MAGT у мін. токен-юнитах),
// користувач натискає "claim" і отримує свої MAGT.
// Контракт тримає MAGT на власному JettonWallet та відправляє transfer користувачу.

import "./stdlib/libs/deploy.tact";

// ---- op-коди ----
const OP_ADMIN_SET:       Int = 0x0AC10A11;   // owner: set allocation (user, amount)
const OP_ADMIN_SET_WALLET:Int = 0x0AC10A12;   // owner: set jetton wallet (jw)
const OP_USER_CLAIM:      Int = 0xC1A10001;   // user: claim all available

// ---- повідомлення ----
message AdminSet {
    user: Address;
    amount: Int;        // у мінімальних юнітах MAGT (з урахуванням decimals)
}

message AdminSetWallet {
    jw: Address;        // нова адреса JettonWallet для цього контракту
}

message UserClaim { }   // без полів

// ---- локальний конструктор payload для Jetton transfer (TIP-3 / Jetton v2) ----
// op = 0x0f8a7ea5
fun buildJettonTransfer(
    amount: Int,                 // кількість у мін. юнітах
    to: Address,                 // власник, що отримає
    responseTo: Address,         // куди JettonWallet шле відповідь
    forwardTon: Int              // скільки TON форвардити реципієнту (зазвичай 0)
): Cell {
    // Побудова за стандартом:
    // uint32 op, uint64 query_id, coins amount, address to, address response_destination,
    // maybe<Cell> custom_payload = null, coins forward_amount, maybe<Cell> forward_payload = null
    let b = beginCell();
    b.storeUint(0x0f8a7ea5, 32);     // op::transfer
    b.storeUint(0, 64);              // query_id
    b.storeCoins(amount);            // amount
    b.storeAddress(to);              // to
    b.storeAddress(responseTo);      // response_destination
    b.storeBit(false);               // custom_payload = null
    b.storeCoins(forwardTon);        // forward_amount
    b.storeBit(false);               // forward_payload = null
    return b.endCell();
}

// ---- хелпер для optional Int ----
fun unwrapOrZero(x: Int?): Int {
    if (x == null) {
        return 0;
    }
    return x!!;
}

contract ClaimManager with Deployable {
    // ---- storage ----
    owner: Address;
    jettonWallet: Address;       // JW цього контракту для MAGT (адреса JettonWallet, НЕ мінтера)
    alloc: map<Address, Int>;    // скільки юзер може ще забрати

    // init:
    //  - owner: хто має право виставляти алокації
    //  - jettonWallet: тимчасове значення; після деплою owner викличе AdminSetWallet
    init(owner: Address, jettonWallet: Address) {
        self.owner = owner;
        self.jettonWallet = jettonWallet;
        // self.alloc — за замовчуванням порожня мапа
    }

    // ---- getters ----
    get fun get_owner(): Address {
        return self.owner;
    }

    get fun get_jetton_wallet(): Address {
        return self.jettonWallet;
    }

    get fun get_alloc(user: Address): Int {
        let v: Int? = self.alloc.get(user);
        return unwrapOrZero(v);
    }

    // ---- receive ----
    // Адмін виставляє квоту на клейм
    receive(msg: AdminSet) {
        require(sender() == self.owner, "ONLY_OWNER");
        require(msg.amount >= 0, "NEG_AMOUNT");
        self.alloc.set(msg.user, msg.amount);
    }

    // Адмін одноразово/за потреби встановлює адресу JettonWallet
    receive(msg: AdminSetWallet) {
        require(sender() == self.owner, "ONLY_OWNER");
        self.jettonWallet = msg.jw;
    }

    // Користувач забирає свою квоту
    receive(msg: UserClaim) {
        let user: Address = sender();

        // читаємо алокацію й перетворюємо optional -> Int
        let amountOpt: Int? = self.alloc.get(user);
        let amount: Int = unwrapOrZero(amountOpt);
        require(amount > 0, "NOTHING_TO_CLAIM");

        // Обнуляємо алокацію перед відправкою (reentrancy-safe)
        self.alloc.set(user, 0);

        // Готуємо тіло transfer
        let fwd_amount: Int = 0;                 
        let body: Cell = buildJettonTransfer(amount, user, myAddress(), fwd_amount);

        // Надсилаємо у JettonWallet контракту з достатнім gas (0.05 TON)
        let msg_value: Int = 50_000_000; // 0.05 TON у нанотонах

        send(SendParameters{
            to: self.jettonWallet,
            value: msg_value,
            body: body
        });
    }

    // Приймаємо вхідні TON (газ/поповнення) — без дій
    receive() { }
}
