import AL, { IPlayerDocument } from "alclient"
import { FilterQuery } from "mongoose"

export type AuthResponse = {
    id: string
    auth: "NO" | "YES" | "CORRECT" | "WRONG"
    owner: "NO" | "YES"
}

/**
 * Checks the key with the value associated to the owner in the database
 * @param owner Owner ID
 * @param key ALData Key
 * @returns `true` if the key matches, `false` otherwise
 */
export async function checkAuthByOwner(owner: string, key: string): Promise<boolean> {
    const result = await AL.PlayerModel.findOne({ aldata: key, owner: owner }).lean().exec()
    return result != null
}

export async function checkAuthByName(id: string, key: string): Promise<AuthResponse> {
    const filter: FilterQuery<IPlayerDocument> = { name: id }

    const character = await AL.PlayerModel.findOne(filter).lean().exec()

    const response: AuthResponse = {
        auth: "NO",
        id: id,
        owner: character.owner == undefined ? "NO" : "YES"
    }

    if (character.aldata) {
        if (key) {
            if (character.aldata == key) {
                response.auth = "CORRECT"
                return response
            } else {
                response.auth = "WRONG"
                return response
            }
        }
        response.auth = "YES"
        return response
    }

    return response
}