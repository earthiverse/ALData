import AL, { BankInfo, IBankDocument } from "alclient"
import { FilterQuery, LeanDocument, UpdateQuery } from "mongoose"

const PRIVATE_OWNERS: string[] = []

export async function getBank(owner: string): Promise<LeanDocument<IBankDocument>> {
    if (PRIVATE_OWNERS.includes(owner)) return // Private bank
    const filter: FilterQuery<IBankDocument> = { owner: owner }

    const bank = await AL.BankModel.findOne(filter, { owner: false }).lean().exec()
    return bank
}

/**
 * IMPORTANT: Check auth key before calling this function!
 * @param owner Owner of the bank
 * @param bank Bank info
 */
export async function updateBank(owner: string, bank: BankInfo): Promise<void> {
    const update: UpdateQuery<IBankDocument> = {
        lastUpdated: Date.now(),
        owner: owner,
        ...bank
    }

    await AL.BankModel.updateOne({ owner: owner }, update, { upsert: true })
}