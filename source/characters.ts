import AL, { IPlayerDocument } from "alclient"
import { FilterQuery } from "mongoose"

const PRIVATE_CHARACTERS: string[] = []

export async function getCharacters(ids: string[]) {
    ids = ids.filter(x => !PRIVATE_CHARACTERS.includes(x))
    if (ids.length == 0) return []

    const filter: FilterQuery<IPlayerDocument> = { name: { $in: ids }, serverIdentifier: { $ne: "PVP" } }

    const characters = []
    for (const character of await AL.PlayerModel.find(filter, {
        lastSeen: 1,
        map: 1,
        name: 1,
        serverIdentifier: 1,
        serverRegion: 1,
        x: 1,
        y: 1
    }).lean().exec()) {
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

export async function getCharactersForOwner(ownerId: string) {
    const filter: FilterQuery<IPlayerDocument> = { name: { $nin: PRIVATE_CHARACTERS }, owner: ownerId }

    const characters = []
    for (const character of await AL.PlayerModel.find(filter, {
        items: 1,
        lastSeen: 1,
        name: 1,
        slots: 1
    }).lean().exec()) {
        characters.push({
            id: character.name,
            items: character.items,
            lastSeen: new Date(character.lastSeen).toISOString(),
            slots: character.slots
        })
    }
    return characters
}

export async function getOwners(ids: string[]) {
    ids = ids.filter(x => !PRIVATE_CHARACTERS.includes(x))
    if (ids.length == 0) return []

    const filter: FilterQuery<IPlayerDocument> = { name: { $in: ids } }

    const characters = []
    for (const character of await AL.PlayerModel.find(filter, {
        name: 1,
        owner: 1
    }).lean().exec()) {
        characters.push({
            id: character.name,
            owner: character.owner
        })
    }
    return characters
}