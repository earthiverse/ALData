import AL, { ServerIdentifier, ServerRegion } from "alclient"

const PRIVATE_NPCS: string[] = []

export async function getNPCs(ids: string[], serverRegion?: ServerRegion, serverIdentifier?: ServerIdentifier) {
    ids = ids.filter(x => !PRIVATE_NPCS.includes(x))
    if (ids.length == 0) return []

    const filters = { name: { $in: ids } }
    if (serverRegion) filters["serverRegion"] = serverRegion
    if (serverIdentifier) filters["serverIdentifier"] = serverIdentifier

    const npcs = []
    for (const npc of await AL.NPCModel.find(filters).lean().exec()) {
        npcs.push({
            id: npc.name,
            items: npc.items,
            lastSeen: new Date(npc.lastSeen).toISOString(),
            map: npc.map,
            serverIdentifier: npc.serverIdentifier,
            serverRegion: npc.serverRegion,
            x: npc.x,
            y: npc.y
        })
    }
    return npcs
}