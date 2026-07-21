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
 * Light validation for a non-empty trimmed string field.
 * @returns Error message, or `null` if valid / omitted
 */
function validateOptionalName(value: unknown, field: string, maxLength: number): string | null {
    if (value === undefined || value === null) return null
    if (typeof value !== "string") return `${field} must be a string`
    const trimmed = value.trim()
    if (trimmed.length === 0) return `${field} must not be empty`
    if (trimmed.length > maxLength) return `${field} must be at most ${maxLength} characters`
    return null
}

/**
 * Light validation for PUT /trades `displayName`.
 * @returns Error message, or `null` if valid
 */
export function validateDisplayName(displayName: unknown): string | null {
    return validateOptionalName(displayName, "displayName", 64)
}

/**
 * Light validation for PUT /trades `discordName`.
 * @returns Error message, or `null` if valid
 */
export function validateDiscordName(discordName: unknown): string | null {
    return validateOptionalName(discordName, "discordName", 64)
}

/**
 * Light validation for PUT /trades `discordId` (Discord snowflake).
 * @returns Error message, or `null` if valid
 */
export function validateDiscordId(discordId: unknown): string | null {
    if (discordId === undefined || discordId === null) return null
    if (typeof discordId !== "string") return "discordId must be a string"
    const trimmed = discordId.trim()
    if (!/^\d{17,20}$/.test(trimmed)) return "discordId must be a Discord snowflake (17-20 digits)"
    return null
}

function trimmedOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
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

function publicOwnerFields(doc: OwnerTradesDoc, characters: string[]) {
    const displayName = trimmedOptionalString(doc.displayName)
    const discordName = trimmedOptionalString(doc.discordName)
    const discordId = trimmedOptionalString(doc.discordId)
    const label = displayName || ownerLabelFromCharacters(characters)

    return {
        listings: (doc.listings ?? []) as TradeListing[],
        lastUpdated: doc.lastUpdated as number | undefined,
        characters,
        ...(displayName ? { displayName } : {}),
        ...(discordName ? { discordName } : {}),
        ...(discordId ? { discordId } : {}),
        ...(label ? { label } : {}),
    }
}

export async function getTrades(owner: string): Promise<{
    listings: TradeListing[]
    lastUpdated?: number
    characters?: string[]
    label?: string
    displayName?: string
    discordName?: string
    discordId?: string
}> {
    if (PRIVATE_OWNERS.includes(owner)) return { listings: [] }

    const filter: FilterQuery<OwnerTradesDoc> = { owner: owner }
    const doc = await TradeModel.findOne(filter, { owner: false, _id: false }).lean().exec()
    if (!doc) return { listings: [] }

    const characters = await charactersForOwners([owner]).then((m) => m.get(owner) ?? [])
    return publicOwnerFields(doc as OwnerTradesDoc, characters)
}

export async function getAllTrades(): Promise<
    {
        owner: string
        listings: TradeListing[]
        lastUpdated?: number
        characters?: string[]
        label?: string
        displayName?: string
        discordName?: string
        discordId?: string
    }[]
> {
    const filter: FilterQuery<OwnerTradesDoc> = {}
    if (PRIVATE_OWNERS.length > 0) {
        filter.owner = { $nin: PRIVATE_OWNERS }
    }

    const docs = await TradeModel.find(filter, { _id: false }).lean().exec()
    const ownerIds: string[] = []
    for (const doc of docs) {
        if (doc.owner) ownerIds.push(doc.owner as string)
    }
    const charactersByOwner = await charactersForOwners(ownerIds)

    const results: {
        owner: string
        listings: TradeListing[]
        lastUpdated?: number
        characters?: string[]
        label?: string
        displayName?: string
        discordName?: string
        discordId?: string
    }[] = []
    for (const doc of docs) {
        const owner = doc.owner as string
        const characters = charactersByOwner.get(owner) ?? []
        results.push({
            owner,
            ...publicOwnerFields(doc as OwnerTradesDoc, characters),
        })
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

async function charactersForOwners(owners: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>()
    if (owners.length === 0) return map

    const players = await AL.PlayerModel.find(
        { owner: { $in: owners } },
        { name: true, owner: true, _id: false },
    )
        .lean()
        .exec()

    for (const player of players) {
        const owner = player.owner as string | undefined
        const name = player.name as string | undefined
        if (!owner || !name) continue
        const list = map.get(owner)
        if (list) list.push(name)
        else map.set(owner, [name])
    }
    return map
}

function applyOptionalMetaField(
    setFields: Record<string, unknown>,
    unsetFields: Record<string, 1>,
    key: keyof TradesOwnerMeta,
    value: string | null | undefined,
): void {
    if (value === undefined) return
    if (value === null) {
        unsetFields[key] = 1
        return
    }
    setFields[key] = value.trim()
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

    applyOptionalMetaField(setFields, unsetFields, "displayName", meta.displayName)
    applyOptionalMetaField(setFields, unsetFields, "discordName", meta.discordName)
    applyOptionalMetaField(setFields, unsetFields, "discordId", meta.discordId)

    const update: UpdateQuery<OwnerTradesDoc> =
        Object.keys(unsetFields).length > 0
            ? { $set: setFields, $unset: unsetFields }
            : { $set: setFields }

    await TradeModel.updateOne({ owner: owner }, update, { upsert: true })
}
