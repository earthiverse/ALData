import AL, { IPlayerDocument } from "alclient"
import { FilterQuery } from "mongoose"

export type AuthResponse = {
    id: string
    response: "NONE" | "OK" | "SET" | "WRONG"
}

export async function checkAuth(id: string, key: string): Promise<AuthResponse> {
    const filter: FilterQuery<IPlayerDocument> = { name: id }

    const character = await AL.PlayerModel.findOne(filter)

    if (character.aldata) {
        if (key) {
            if (character.aldata == key) {
                return {
                    id: id,
                    response: "OK"
                }
            } else {
                return {
                    id: id,
                    response: "WRONG"
                }
            }
        }
        return {
            id: id,
            response: "SET"
        }
    } else {
        return {
            id: id,
            response: "NONE"
        }
    }
}