import AL, { IAchievementDocument, TrackerData } from "alclient"
import { FilterQuery, LeanDocument } from "mongoose"

const PRIVATE_ACHIEVEMENTS: string[] = []

export async function getAchievements(name: string): Promise<LeanDocument<IAchievementDocument>> {
    if (PRIVATE_ACHIEVEMENTS.includes(name)) return // Private achievements
    const filter: FilterQuery<IAchievementDocument> = { owner: name }

    const achievements = await AL.AchievementModel.findOne(filter, { owner: false }, { sort: { date: -1 } }).lean().exec()
    return achievements
}

/**
 * IMPORTANT: Check auth key before calling this function!
 * @param name Character ID
 * @param tracker Tracker Data
 */
export async function updateAchievements(name: string, tracker: TrackerData): Promise<void> {
    await AL.AchievementModel.create({
        date: Date.now(),
        max: tracker.max,
        monsters: tracker.monsters,
        name: name,
        ...tracker
    })
}