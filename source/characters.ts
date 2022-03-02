import AL, { IPlayerDocument } from "alclient"
import { FilterQuery } from "mongoose"

const PRIVATE_CHARACTERS: string[] = []

export async function getCharacters(ids: string[]) {
    ids = ids.filter(x => !PRIVATE_CHARACTERS.includes(x))
    if (ids.length == 0) return []

    const filters: FilterQuery<IPlayerDocument> = { name: { $in: ids }, serverIdentifier: { $ne: "PVP" } }

    const characters = []
    for (const character of await AL.PlayerModel.find(filters).lean().exec()) {
        characters.push({
            id: character.name,
            lastSeen: new Date(character.lastSeen).toISOString(),
            map: character.map,
            serverIdentifier: character.serverIdentifier,
            serverRegion: character.serverRegion,
            x: character.x,
            y: character.y
        })
    }
    return characters
}