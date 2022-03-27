import AL, { IAchievementDocument, TrackerData } from "alclient"
import { MonsterName } from "alclient"
import { FilterQuery, LeanDocument } from "mongoose"

/**
 * The first element is the date, the 2nd element is the
 */
export type MonsterAchievementProgress = {
    date: number
    count: number
}[]

const PRIVATE_ACHIEVEMENTS: string[] = []

export async function getAchievements(name: string): Promise<LeanDocument<IAchievementDocument>> {
    if (PRIVATE_ACHIEVEMENTS.includes(name)) return // Private achievements
    const filter: FilterQuery<IAchievementDocument> = { name: name }

    const achievements = await AL.AchievementModel.findOne(filter, { date: false, name: false }, { sort: { date: -1 } }).lean().exec()
    return achievements
}

export async function getAchievementsForMonster(name: string, monster: MonsterName): Promise<MonsterAchievementProgress> {
    const progress = await AL.AchievementModel.aggregate([
        {
            $match: {
                name: name
            }
        },
        {
            $sort: {
                date: -1
            }
        },
        {
            $project: {
                _id: 0,
                "date": 1,
                "count": `$monsters.${monster}`
            }
        }
    ]).exec()
    return progress
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