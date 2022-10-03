import AL, { IPlayerDocument, TradeSlotType } from "alclient"
import { FilterQuery } from "mongoose"

const PRIVATE_MERCHANTS: string[] = []

export async function getMerchants(ids?: string[]) {
    const filter: FilterQuery<IPlayerDocument> = {
        $or: [
            { "slots.trade1": { "$ne": undefined } },
            { "slots.trade2": { "$ne": undefined } },
            { "slots.trade3": { "$ne": undefined } },
            { "slots.trade4": { "$ne": undefined } },
            { "slots.trade5": { "$ne": undefined } },
            { "slots.trade6": { "$ne": undefined } },
            { "slots.trade7": { "$ne": undefined } },
            { "slots.trade8": { "$ne": undefined } },
            { "slots.trade9": { "$ne": undefined } },
            { "slots.trade10": { "$ne": undefined } },
            { "slots.trade11": { "$ne": undefined } },
            { "slots.trade12": { "$ne": undefined } },
            { "slots.trade13": { "$ne": undefined } },
            { "slots.trade14": { "$ne": undefined } },
            { "slots.trade15": { "$ne": undefined } },
            { "slots.trade16": { "$ne": undefined } },
            { "slots.trade17": { "$ne": undefined } },
            { "slots.trade18": { "$ne": undefined } },
            { "slots.trade19": { "$ne": undefined } },
            { "slots.trade20": { "$ne": undefined } },
            { "slots.trade21": { "$ne": undefined } },
            { "slots.trade22": { "$ne": undefined } },
            { "slots.trade23": { "$ne": undefined } },
            { "slots.trade24": { "$ne": undefined } },
            { "slots.trade25": { "$ne": undefined } },
            { "slots.trade26": { "$ne": undefined } },
            { "slots.trade27": { "$ne": undefined } },
            { "slots.trade28": { "$ne": undefined } },
            { "slots.trade29": { "$ne": undefined } },
            { "slots.trade30": { "$ne": undefined } },
        ],
        lastSeen: { $gt: Date.now() - 6.048e+8 } // Past week
    }

    if (ids) {
        ids = ids.filter(x => !PRIVATE_MERCHANTS.includes(x))
        if (ids.length == 0) return []
        filter.name = { $in: ids }
    }

    const merchants = []
    for (const merchant of await AL.PlayerModel.find(filter, {
        lastSeen: 1,
        map: 1,
        name: 1,
        serverIdentifier: 1,
        serverRegion: 1,
        "slots.trade1": 1,
        "slots.trade2": 1,
        "slots.trade3": 1,
        "slots.trade4": 1,
        "slots.trade5": 1,
        "slots.trade6": 1,
        "slots.trade7": 1,
        "slots.trade8": 1,
        "slots.trade9": 1,
        "slots.trade10": 1,
        "slots.trade11": 1,
        "slots.trade12": 1,
        "slots.trade13": 1,
        "slots.trade14": 1,
        "slots.trade15": 1,
        "slots.trade16": 1,
        "slots.trade17": 1,
        "slots.trade18": 1,
        "slots.trade19": 1,
        "slots.trade20": 1,
        "slots.trade21": 1,
        "slots.trade22": 1,
        "slots.trade23": 1,
        "slots.trade24": 1,
        "slots.trade25": 1,
        "slots.trade26": 1,
        "slots.trade27": 1,
        "slots.trade28": 1,
        "slots.trade29": 1,
        "slots.trade30": 1,
        x: 1,
        y: 1
    }).lean().exec()) {
        for (const slotName in merchant.slots) {
            const slot = merchant.slots[slotName as TradeSlotType]

            // Remove null slots
            if (slot == null) delete merchant.slots[slotName as TradeSlotType]
            // Remove rid data
            else delete slot.rid
        }

        merchants.push({
            id: merchant.name,
            lastSeen: new Date(merchant.lastSeen).toISOString(),
            map: merchant.map,
            serverIdentifier: merchant.serverIdentifier,
            serverRegion: merchant.serverRegion,
            slots: merchant.slots,
            x: merchant.x,
            y: merchant.y,
        })
    }
    return merchants
}