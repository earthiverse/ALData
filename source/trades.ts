import AL from "alclient"
import type { FilterQuery, UpdateQuery } from "mongoose"
import { getCharacterNamesByOwners } from "./characters.js"

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
export type OwnerTrades = {
    owner: string
    lastUpdated: number
    listings: TradeListing[]
    /** Preferred public name for all listings (overrides derived character prefix). */
    displayName?: string
    /** Discord username / display name (plain text — never used as a ping by bots). */
    discordName?: string
    /** Discord user snowflake for client copy-paste mentions (`<@id>`). */
    discordId?: string
}

/** Optional owner-level fields accepted by PUT /trades (null clears). */
export type TradesOwnerMeta = {
    displayName?: string | null
    discordName?: string | null
    discordId?: string | null
}

/** Public trade payload without owner id (GET /trades/:owner). */
export type PublicTradesDto = {
    listings: TradeListing[]
    lastUpdated?: number
    characters?: string[]
    label?: string
    displayName?: string
    discordName?: string
    discordId?: string
}

/** Public trade payload with owner id (GET /trades). */
export type PublicOwnerTradesDto = PublicTradesDto & { owner: string }

export type ParseTradePutBodyResult =
    | { ok: true; listings: TradeListing[]; meta: TradesOwnerMeta }
    | { ok: false; error: string }

type OwnerTradesDoc = OwnerTrades & { _id?: unknown }

type OwnerMetaFieldSpec = {
    key: keyof TradesOwnerMeta
    /** Validate a non-null value; returns error or trimmed string to store. */
    normalize: (value: unknown) => { ok: true; value: string } | { ok: false; error: string }
}

const OWNER_META_FIELDS: OwnerMetaFieldSpec[] = [
    {
        key: "displayName",
        normalize: (value) => normalizeOptionalName(value, "displayName", 64),
    },
    {
        key: "discordName",
        normalize: (value) => normalizeOptionalName(value, "discordName", 64),
    },
    {
        key: "discordId",
        normalize: (value) => {
            if (typeof value !== "string") return { ok: false, error: "discordId must be a string" }
            const trimmed = value.trim()
            if (!/^\d{17,20}$/.test(trimmed)) {
                return { ok: false, error: "discordId must be a Discord snowflake (17-20 digits)" }
            }
            return { ok: true, value: trimmed }
        },
    },
]

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
    discordId: { required: false, type: String },
    discordName: { required: false, type: String },
    displayName: { required: false, type: String },
    lastUpdated: { required: false, type: Number },
    listings: { default: [], required: true, type: [TradeListingSchema] },
    owner: { required: true, type: String },
})

// Collection name becomes "trades" (mongoose pluralizes "trade")
export const TradeModel = mongoose.model("trade", OwnerTradesSchema)

function isNonNegativeNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0
}

function normalizeOptionalName(
    value: unknown,
    field: string,
    maxLength: number,
): { ok: true; value: string } | { ok: false; error: string } {
    if (typeof value !== "string") return { ok: false, error: `${field} must be a string` }
    const trimmed = value.trim()
    if (trimmed.length === 0) return { ok: false, error: `${field} must not be empty` }
    if (trimmed.length > maxLength) return { ok: false, error: `${field} must be at most ${maxLength} characters` }
    return { ok: true, value: trimmed }
}

function parseItemRef(
    value: unknown,
    path: string,
): { ok: true; item: ItemRef } | { ok: false; error: string } {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { ok: false, error: `${path} must be an object` }
    }
    const raw = value as Record<string, unknown>
    if (typeof raw.name !== "string" || raw.name.length === 0) {
        return { ok: false, error: `${path}.name must be a non-empty string` }
    }

    const item: ItemRef = { name: raw.name }
    if (raw.level !== undefined) {
        if (!isNonNegativeNumber(raw.level)) {
            return { ok: false, error: `${path}.level must be a non-negative number` }
        }
        item.level = raw.level
    }
    if (raw.p !== undefined) {
        if (typeof raw.p !== "string" || raw.p.length === 0) {
            return { ok: false, error: `${path}.p must be a non-empty string` }
        }
        item.p = raw.p
    }
    return { ok: true, item }
}

function parseNote(
    note: unknown,
    path: string,
): { ok: true; note?: string } | { ok: false; error: string } {
    if (note === undefined) return { ok: true }
    if (typeof note !== "string") return { ok: false, error: `${path} must be a string` }
    return { ok: true, note }
}

function parseTradeOffers(
    trades: unknown,
    path: string,
): { ok: true; trades?: TradeOffer[] } | { ok: false; error: string } {
    if (trades === undefined) return { ok: true }
    if (!Array.isArray(trades)) return { ok: false, error: `${path} must be an array` }

    const parsed: TradeOffer[] = []
    for (let i = 0; i < trades.length; i++) {
        const offer = trades[i]
        if (!offer || typeof offer !== "object" || Array.isArray(offer)) {
            return { ok: false, error: `${path}[${i}] must be an object` }
        }
        const raw = offer as Record<string, unknown>
        const itemResult = parseItemRef(raw.item, `${path}[${i}].item`)
        if (itemResult.ok === false) return { ok: false, error: itemResult.error }
        if (!isNonNegativeNumber(raw.give)) {
            return { ok: false, error: `${path}[${i}].give must be a non-negative number` }
        }
        if (!isNonNegativeNumber(raw.receive)) {
            return { ok: false, error: `${path}[${i}].receive must be a non-negative number` }
        }
        if (raw.negotiable !== undefined && typeof raw.negotiable !== "boolean") {
            return { ok: false, error: `${path}[${i}].negotiable must be a boolean` }
        }

        const tradeOffer: TradeOffer = {
            item: itemResult.item,
            give: raw.give,
            receive: raw.receive,
        }
        if (typeof raw.negotiable === "boolean") tradeOffer.negotiable = raw.negotiable
        parsed.push(tradeOffer)
    }

    return { ok: true, trades: parsed }
}

function parseTradeSide(
    side: unknown,
    path: string,
): { ok: true; side?: TradeSide } | { ok: false; error: string } {
    if (side === undefined) return { ok: true }
    if (!side || typeof side !== "object" || Array.isArray(side)) {
        return { ok: false, error: `${path} must be an object` }
    }

    const raw = side as Record<string, unknown>
    const tradeSide: TradeSide = {}

    if (raw.price !== undefined) {
        if (!isNonNegativeNumber(raw.price)) {
            return { ok: false, error: `${path}.price must be a non-negative number` }
        }
        tradeSide.price = raw.price
    }
    if (raw.priceNegotiable !== undefined) {
        if (typeof raw.priceNegotiable !== "boolean") {
            return { ok: false, error: `${path}.priceNegotiable must be a boolean` }
        }
        tradeSide.priceNegotiable = raw.priceNegotiable
    }
    if (raw.quantity !== undefined) {
        if (!isNonNegativeNumber(raw.quantity)) {
            return { ok: false, error: `${path}.quantity must be a non-negative number` }
        }
        tradeSide.quantity = raw.quantity
    }

    const noteResult = parseNote(raw.note, `${path}.note`)
    if (noteResult.ok === false) return { ok: false, error: noteResult.error }
    if (noteResult.note !== undefined) tradeSide.note = noteResult.note

    const tradesResult = parseTradeOffers(raw.trades, `${path}.trades`)
    if (tradesResult.ok === false) return { ok: false, error: tradesResult.error }
    if (tradesResult.trades !== undefined) tradeSide.trades = tradesResult.trades

    const hasContent =
        tradeSide.price !== undefined ||
        tradeSide.priceNegotiable !== undefined ||
        tradeSide.note !== undefined ||
        tradeSide.quantity !== undefined ||
        (tradeSide.trades !== undefined && tradeSide.trades.length > 0)
    if (!hasContent) return { ok: false, error: `${path} must not be empty` }

    return { ok: true, side: tradeSide }
}

function parseListings(
    listings: unknown,
): { ok: true; listings: TradeListing[] } | { ok: false; error: string } {
    if (!Array.isArray(listings)) return { ok: false, error: "listings must be an array" }

    const parsed: TradeListing[] = []
    for (let i = 0; i < listings.length; i++) {
        const entry = listings[i]
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            return { ok: false, error: `listings[${i}] must be an object` }
        }

        const raw = entry as Record<string, unknown>
        const itemResult = parseItemRef(raw, `listings[${i}]`)
        if (itemResult.ok === false) return { ok: false, error: itemResult.error }

        if (raw.wts === undefined && raw.wtb === undefined) {
            return { ok: false, error: `listings[${i}] must include at least one of wts or wtb` }
        }

        const listing: TradeListing = { ...itemResult.item }

        const noteResult = parseNote(raw.note, `listings[${i}].note`)
        if (noteResult.ok === false) return { ok: false, error: noteResult.error }
        if (noteResult.note !== undefined) listing.note = noteResult.note

        const wtsResult = parseTradeSide(raw.wts, `listings[${i}].wts`)
        if (wtsResult.ok === false) return { ok: false, error: wtsResult.error }
        if (wtsResult.side !== undefined) listing.wts = wtsResult.side

        const wtbResult = parseTradeSide(raw.wtb, `listings[${i}].wtb`)
        if (wtbResult.ok === false) return { ok: false, error: wtbResult.error }
        if (wtbResult.side !== undefined) listing.wtb = wtbResult.side

        parsed.push(listing)
    }

    return { ok: true, listings: parsed }
}

function parseOwnerMeta(
    body: Record<string, unknown>,
): { ok: true; meta: TradesOwnerMeta } | { ok: false; error: string } {
    const meta: TradesOwnerMeta = {}

    for (const spec of OWNER_META_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(body, spec.key)) continue
        const value = body[spec.key]
        if (value === null) {
            meta[spec.key] = null
            continue
        }
        const normalized = spec.normalize(value)
        if (normalized.ok === false) return { ok: false, error: normalized.error }
        meta[spec.key] = normalized.value
    }

    return { ok: true, meta }
}

/**
 * Parse and validate PUT /trades bodies (array of listings, or `{ listings, ...meta }`).
 */
export function parseTradePutBody(body: unknown): ParseTradePutBodyResult {
    const listingsRaw = Array.isArray(body)
        ? body
        : body && typeof body === "object"
          ? (body as Record<string, unknown>).listings
          : undefined

    const listingsResult = parseListings(listingsRaw)
    if (listingsResult.ok === false) return { ok: false, error: listingsResult.error }

    let meta: TradesOwnerMeta = {}
    if (!Array.isArray(body) && body && typeof body === "object") {
        const metaResult = parseOwnerMeta(body as Record<string, unknown>)
        if (metaResult.ok === false) return { ok: false, error: metaResult.error }
        meta = metaResult.meta
    }

    return { ok: true, listings: listingsResult.listings, meta }
}

function trimmedOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
}

function toPublicTradesDto(doc: OwnerTradesDoc, characters: string[]): PublicTradesDto {
    const displayName = trimmedOptionalString(doc.displayName)
    const discordName = trimmedOptionalString(doc.discordName)
    const discordId = trimmedOptionalString(doc.discordId)
    const label = displayName || ownerLabelFromCharacters(characters)

    const dto: PublicTradesDto = {
        listings: Array.isArray(doc.listings) ? doc.listings : [],
        characters,
    }
    if (typeof doc.lastUpdated === "number") dto.lastUpdated = doc.lastUpdated
    if (displayName) dto.displayName = displayName
    if (discordName) dto.discordName = discordName
    if (discordId) dto.discordId = discordId
    if (label) dto.label = label
    return dto
}

function toPublicOwnerTradesDto(doc: OwnerTradesDoc, characters: string[]): PublicOwnerTradesDto {
    return {
        owner: doc.owner,
        ...toPublicTradesDto(doc, characters),
    }
}

export async function getTrades(owner: string): Promise<PublicTradesDto> {
    if (PRIVATE_OWNERS.includes(owner)) return { listings: [] }

    const filter: FilterQuery<OwnerTradesDoc> = { owner: owner }
    const doc = await TradeModel.findOne(filter, { owner: false, _id: false }).lean().exec()
    if (!doc) return { listings: [] }

    const characters = await getCharacterNamesByOwners([owner]).then((m) => m.get(owner) ?? [])
    return toPublicTradesDto(doc as OwnerTradesDoc, characters)
}

export async function getAllTrades(): Promise<PublicOwnerTradesDto[]> {
    const filter: FilterQuery<OwnerTradesDoc> = {}
    if (PRIVATE_OWNERS.length > 0) {
        filter.owner = { $nin: PRIVATE_OWNERS }
    }

    const docs = await TradeModel.find(filter, { _id: false }).lean().exec()
    const ownerIds: string[] = []
    for (const doc of docs) {
        if (typeof doc.owner === "string") ownerIds.push(doc.owner)
    }
    const charactersByOwner = await getCharacterNamesByOwners(ownerIds)

    const results: PublicOwnerTradesDto[] = []
    for (const doc of docs) {
        if (typeof doc.owner !== "string") continue
        const characters = charactersByOwner.get(doc.owner) ?? []
        results.push(toPublicOwnerTradesDto(doc as OwnerTradesDoc, characters))
    }
    return results
}

/**
 * Derive a short display name from character names (e.g. earthMer, earthWar → "earth").
 */
export function ownerLabelFromCharacters(characters: string[]): string | undefined {
    const names: string[] = []
    for (const name of characters) {
        if (name) names.push(name)
    }
    if (names.length === 0) return undefined

    let prefix = names[0]
    for (let i = 1; i < names.length; i++) {
        const name = names[i]
        while (prefix.length > 0 && !name.startsWith(prefix)) {
            prefix = prefix.slice(0, -1)
        }
    }

    if (prefix.length >= 2) return prefix
    return names[0]
}

/**
 * IMPORTANT: Check auth key before calling this function!
 * @param owner Owner of the trade listings
 * @param listings Trade listings to store
 * @param meta Optional owner-level fields (`null` clears a field)
 */
export async function updateTrades(
    owner: string,
    listings: TradeListing[],
    meta: TradesOwnerMeta = {},
): Promise<void> {
    const setFields: Record<string, unknown> = {
        lastUpdated: Date.now(),
        listings: listings,
        owner: owner,
    }
    const unsetFields: Record<string, 1> = {}

    for (const spec of OWNER_META_FIELDS) {
        const value = meta[spec.key]
        if (value === undefined) continue
        if (value === null) {
            unsetFields[spec.key] = 1
            continue
        }
        setFields[spec.key] = value.trim()
    }

    const update: UpdateQuery<OwnerTradesDoc> =
        Object.keys(unsetFields).length > 0
            ? { $set: setFields, $unset: unsetFields }
            : { $set: setFields }

    await TradeModel.updateOne({ owner: owner }, update, { upsert: true })
}
