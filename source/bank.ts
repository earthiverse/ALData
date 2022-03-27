import AL, { BankInfo, IBankDocument } from "alclient"
import { FilterQuery, UpdateQuery } from "mongoose"

const PRIVATE_OWNERS: string[] = []

export async function getBank(owner: string): Promise<BankInfo> {
    if (PRIVATE_OWNERS.includes(owner)) return // Private bank
    const filter: FilterQuery<IBankDocument> = { owner: owner, private: { $ne: true } }

    const bank = await AL.BankModel.findOne(filter, { owner: false }).lean().exec()
    return bank
}

export async function updateBank(owner: string, key: string, bank: BankInfo): Promise<void> {
    const update: UpdateQuery<IBankDocument> = {
        lastUpdated: Date.now(),
        owner: owner,
        ...bank
    }

    await AL.BankModel.updateOne({ owner: owner }, update, { upsert: true })
}