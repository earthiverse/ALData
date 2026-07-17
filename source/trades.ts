import AL from "alclient"
import type { FilterQuery, UpdateQuery } from "mongoose"

const PRIVATE_OWNERS: string[] = []

export type ItemRef = { name: string; level?: number; p?: string }
export type TradeOffer = { item: ItemRef; give: number; receive: number; negotiable?: boolean }
export type TradeSide = {
    price?: number
    priceNegotiable?: boolean
    note?: string
    quantity?: number
    trades?: TradeOffer[]
}
export type TradeListing = ItemRef & { note?: string; wts?: TradeSide; wtb?: TradeSide }
export type OwnerTrades = { owner: string; lastUpdated: number; listings: TradeListing[] }

type OwnerTradesDoc = OwnerTrades & { _id?: unknown }

// Reuse alclient's mongoose connection/instance (same default connection as BankModel)
const mongoose = AL.BankModel.base
const { Schema } = mongoose

const ItemRefSchema = new Schema(
    {
        name: { required: true, type: String },
        level: { required: false, type: Number },
        p: { required: false, type: String },
    },
    { _id: false },
)

const TradeOfferSchema = new Schema(
    {
        item: { required: true, type: ItemRefSchema },
        give: { required: true, type: Number },
        receive: { required: true, type: Number },
        negotiable: { required: false, type: Boolean },
    },
    { _id: false },
)

const TradeSideSchema = new Schema(
    {
        price: { required: false, type: Number },
        priceNegotiable: { required: false, type: Boolean },
        note: { required: false, type: String },
        quantity: { required: false, type: Number },
        trades: { required: false, type: [TradeOfferSchema] },
    },
    { _id: false },
)

const TradeListingSchema = new Schema(
    {
        name: { required: true, type: String },
        level: { required: false, type: Number },
        p: { required: false, type: String },
        note: { required: false, type: String },
        wts: { required: false, type: TradeSideSchema },
        wtb: { required: false, type: TradeSideSchema },
    },
    { _id: false },
)

const OwnerTradesSchema = new Schema({
    __v: {
        select: false,
        type: Number,
    },
    lastUpdated: { required: false, type: Number },
    listings: { default: [], required: true, type: [TradeListingSchema] },
    owner: { required: true, type: String },
})

// Collection name becomes "trades" (mongoose pluralizes "trade")
export const TradeModel = mongoose.model("trade", OwnerTradesSchema)

function isNonNegativeNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function validateNote(note: unknown, path: string): string | null {
    if (note === undefined) return null
    if (typeof note !== "string") return `${path} must be a string`
    return null
}

function validateTradeOffers(trades: unknown, path: string): string | null {
    if (trades === undefined) return null
    if (!Array.isArray(trades)) return `${path} must be an array`

    for (let i = 0; i < trades.length; i++) {
        const offer = trades[i]
        if (!offer || typeof offer !== "object") return `${path}[${i}] must be an object`
        const tradeOffer = offer as TradeOffer
        if (!tradeOffer.item || typeof tradeOffer.item !== "object") {
            return `${path}[${i}].item must be an object`
        }
        if (typeof tradeOffer.item.name !== "string" || tradeOffer.item.name.length === 0) {
            return `${path}[${i}].item.name must be a non-empty string`
        }
        if (!isNonNegativeNumber(tradeOffer.give)) return `${path}[${i}].give must be a non-negative number`
        if (!isNonNegativeNumber(tradeOffer.receive)) {
            return `${path}[${i}].receive must be a non-negative number`
        }
        if (tradeOffer.negotiable !== undefined && typeof tradeOffer.negotiable !== "boolean") {
            return `${path}[${i}].negotiable must be a boolean`
        }
    }

    return null
}

function validateTradeSide(side: unknown, path: string): string | null {
    if (side === undefined) return null
    if (!side || typeof side !== "object") return `${path} must be an object`

    const tradeSide = side as TradeSide
    if (tradeSide.price !== undefined && !isNonNegativeNumber(tradeSide.price)) {
        return `${path}.price must be a non-negative number`
    }
    if (tradeSide.priceNegotiable !== undefined && typeof tradeSide.priceNegotiable !== "boolean") {
        return `${path}.priceNegotiable must be a boolean`
    }
    if (tradeSide.quantity !== undefined && !isNonNegativeNumber(tradeSide.quantity)) {
        return `${path}.quantity must be a non-negative number`
    }

    const noteError = validateNote(tradeSide.note, `${path}.note`)
    if (noteError) return noteError

    const tradesError = validateTradeOffers(tradeSide.trades, `${path}.trades`)
    if (tradesError) return tradesError

    return null
}

/**
 * Light validation for PUT /trades bodies.
 * @returns Error message, or `null` if valid
 */
export function validateListings(listings: unknown): string | null {
    if (!Array.isArray(listings)) return "listings must be an array"

    for (let i = 0; i < listings.length; i++) {
        const entry = listings[i]
        if (!entry || typeof entry !== "object") return `listings[${i}] must be an object`

        const listing = entry as TradeListing
        if (typeof listing.name !== "string" || listing.name.length === 0) {
            return `listings[${i}].name must be a non-empty string`
        }
        if (!listing.wts && !listing.wtb) {
            return `listings[${i}] must include at least one of wts or wtb`
        }

        const noteError = validateNote(listing.note, `listings[${i}].note`)
        if (noteError) return noteError

        const wtsError = validateTradeSide(listing.wts, `listings[${i}].wts`)
        if (wtsError) return wtsError

        const wtbError = validateTradeSide(listing.wtb, `listings[${i}].wtb`)
        if (wtbError) return wtbError
    }

    return null
}

export async function getTrades(owner: string): Promise<{ listings: TradeListing[]; lastUpdated?: number }> {
    if (PRIVATE_OWNERS.includes(owner)) return { listings: [] }

    const filter: FilterQuery<OwnerTradesDoc> = { owner: owner }
    const doc = await TradeModel.findOne(filter, { owner: false, _id: false }).lean().exec()
    if (!doc) return { listings: [] }

    return {
        listings: (doc.listings ?? []) as TradeListing[],
        lastUpdated: doc.lastUpdated as number | undefined,
    }
}

export async function getAllTrades(): Promise<
    { owner: string; listings: TradeListing[]; lastUpdated?: number }[]
> {
    const filter: FilterQuery<OwnerTradesDoc> = {}
    if (PRIVATE_OWNERS.length > 0) {
        filter.owner = { $nin: PRIVATE_OWNERS }
    }

    const docs = await TradeModel.find(filter, { _id: false }).lean().exec()
    const results: { owner: string; listings: TradeListing[]; lastUpdated?: number }[] = []
    for (const doc of docs) {
        results.push({
            owner: doc.owner as string,
            listings: (doc.listings ?? []) as TradeListing[],
            lastUpdated: doc.lastUpdated as number | undefined,
        })
    }
    return results
}

/**
 * IMPORTANT: Check auth key before calling this function!
 * @param owner Owner of the trade listings
 * @param listings Trade listings to store
 */
export async function updateTrades(owner: string, listings: TradeListing[]): Promise<void> {
    const update: UpdateQuery<OwnerTradesDoc> = {
        lastUpdated: Date.now(),
        listings: listings,
        owner: owner,
    }

    await TradeModel.updateOne({ owner: owner }, update, { upsert: true })
}
