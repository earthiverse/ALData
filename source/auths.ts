import AL, { IPlayerDocument } from "alclient"
import { FilterQuery } from "mongoose"

export type AuthResponse = {
    id: string
    auth: "NO" | "YES" | "CORRECT" | "WRONG"
    owner: "NO" | "YES"
}

export async function checkAuth(id: string, key: string): Promise<AuthResponse> {
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