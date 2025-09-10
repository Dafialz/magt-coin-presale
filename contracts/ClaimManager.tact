// ClaimManager.tact
// Режим: авто-роздача MAGT при вхідному платіжі на контракт.
// Зберігаємо також старий механізм алокацій (AdminSet + UserClaim).

import "./stdlib/libs/deploy.tact";

// ---- опкоди для клієнтських врапперів (інформативно) ----
const OP_ADMIN_SET:        Int = 0x0AC10A11;   // owner: set allocation (user, amount)
const OP_ADMIN_SET_WALLET: Int = 0x0AC10A12;   // owner: set jetton wallet (jw)
const OP_USER_CLAIM:       Int = 0xC1A10001;   // user: claim all available
// Для фронта ми шлемо payload з 'BUY1', але контракт приймає будь-який невідомий body у receive()
// і трактує це як BUY, якщо прийшли TON. Це знімає вимогу точно співпасти з op-кодом.

// ---- повідомлення ----
message AdminSet {
    user: Address;
    amount: Int;        // у мінімальних юнітах MAGT (з урахуванням decimals)
}

message AdminSetWallet {
    jw: Address;        // нова адреса JettonWallet для цього контракту
}

message AdminSetPrice {
    // Ціна в НАНОТОНАХ за 1 MAGT (мін. одиницю з decimals=9)
    // Напр., 0.003734 TON/MAGT => 3_734_000 нанотон
    priceNanoTonPerMAGT: Int;
}

message UserClaim { }   // без полів

// ---- локальний конструктор payload для Jetton transfer (TIP-3 / Jetton v2) ----
// op = 0x0f8a7ea5
fun buildJettonTransfer(
    amount: Int,                 // кількість у мін. юнітах (decimals=9)
    to: Address,                 // власник, що отримає MAGT
    responseTo: Address,         // куди JettonWallet шле відповідь
    forwardTon: Int              // скільки TON форвардити у наступне повідомлення (для відкриття гаманця тощо)
): Cell {
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
    owner: Address;               // власник (treasury отримує TON)
    jettonWallet: Address;        // JW цього контракту для MAGT
    alloc: map<Address, Int>;     // алокації для ручного клейму
    priceNanoTonPerMAGT: Int;     // ціна у нанотонах за 1 MAGT (дефолт нижче)

    // Газ на виклик JettonWallet та forward на отримувача (для створення/доставки)
    static const JW_GAS:     Int = 40_000_000;   // ~0.04 TON на джеттон-операцію
    static const FWD_TON:    Int = 30_000_000;   // ~0.03 TON на forward_amount
    // Мінімальна сума для покупки (щоб уникнути tx з копійками)
    static const MIN_BUY:    Int = 10_000_000;   // 0.01 TON

    // init:
    //  - owner: хто має право виставляти алокації/ціну/гаманець JW і отримує TON
    //  - jettonWallet: тимчасове значення; після деплою owner викличе AdminSetWallet
    //  - priceNanoTonPerMAGT: дефолт 3_734_000 (0.003734 TON/MAGT)
    init(owner: Address, jettonWallet: Address) {
        self.owner = owner;
        self.jettonWallet = jettonWallet;
        self.priceNanoTonPerMAGT = 3_734_000; // дефолт; можна змінити AdminSetPrice
        // self.alloc — порожня мапа за замовчуванням
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

    get fun get_price(): Int {
        return self.priceNanoTonPerMAGT;
    }

    // ---- admin messages ----
    receive(msg: AdminSet) {
        require(sender() == self.owner, "ONLY_OWNER");
        require(msg.amount >= 0, "NEG_AMOUNT");
        self.alloc.set(msg.user, msg.amount);
    }

    receive(msg: AdminSetWallet) {
        require(sender() == self.owner, "ONLY_OWNER");
        self.jettonWallet = msg.jw;
    }

    receive(msg: AdminSetPrice) {
        require(sender() == self.owner, "ONLY_OWNER");
        require(msg.priceNanoTonPerMAGT > 0, "BAD_PRICE");
        self.priceNanoTonPerMAGT = msg.priceNanoTonPerMAGT;
    }

    // ---- user claim (ручний режим, лишаємо сумісність)
    receive(msg: UserClaim) {
        let user: Address = sender();

        let amountOpt: Int? = self.alloc.get(user);
        let amount: Int = unwrapOrZero(amountOpt);
        require(amount > 0, "NOTHING_TO_CLAIM");

        // Обнуляємо алокацію перед відправкою (reentrancy-safe)
        self.alloc.set(user, 0);

        // Пакуємо transfer
        let body: Cell = buildJettonTransfer(amount, user, myAddress(), 0);

        // Вартість повідомлення у JW (газ)
        let msg_value: Int = ClaimManager.JW_GAS;

        send(SendParameters{
            to: self.jettonWallet,
            value: msg_value,
            body: body
        });
    }

    // ---- AUTO-BUY ----
    // Будь-який внутрішній меседж з TON, що не збігся з admin/user повідомленнями,
    // трактуємо як "покупку MAGT" за поточною ціною:
    //   tokens = max( (msg_value - (JW_GAS + FWD_TON)) / price, 0 )
    // і відправляємо jetton transfer покупцеві.
    receive() {
        let payer: Address = sender();
        let incoming: Int = msg_value();

        // Якщо прийшли копійки або 0 — ігноруємо.
        if (incoming < ClaimManager.MIN_BUY + ClaimManager.JW_GAS + ClaimManager.FWD_TON) {
            // просто приймаємо TON як донат/газ і нічого не робимо
            return;
        }

        // Кошти на виклик JettonWallet + forward отримувачу
        let jw_call_fund: Int = ClaimManager.JW_GAS + ClaimManager.FWD_TON;

        // Доступна сума на покупку
        let pay: Int = incoming - jw_call_fund;

        // Скільки MAGT продати (ціна — у нанотонах за 1 MAGT)
        let price: Int = self.priceNanoTonPerMAGT;
        let tokens: Int = pay / price;

        if (tokens <= 0) {
            // некоректний платіж — повертаємо все власнику як дохід (або можна повернути платнику)
            // Ми не робимо refund, щоб уникнути реитерацій — просто відправимо все в treasury
            send(SendParameters{
                to: self.owner,
                value: incoming
            });
            return;
        }

        // 1) Відправляємо jetton transfer на адресу покупця
        let body: Cell = buildJettonTransfer(tokens, payer, myAddress(), ClaimManager.FWD_TON);

        send(SendParameters{
            to: self.jettonWallet,
            value: jw_call_fund,   // газ + forward на гаманці користувача
            body: body
        });

        // 2) Решту TON переказуємо у treasury (owner)
        let toTreasury: Int = incoming - jw_call_fund;
        if (toTreasury > 0) {
            send(SendParameters{
                to: self.owner,
                value: toTreasury
            });
        }
    }
}
