import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export function dataPath(fileName) {
    return path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), fileName)
}

/** Atomic write. The tmp name is unique because two containers share DATA_DIR during a deploy. */
export async function writeJsonFile(filePath, data, space) {
    await mkdir(path.dirname(filePath), { recursive: true })
    const tmpPath = `${filePath}.${randomUUID()}.tmp`
    await writeFile(tmpPath, JSON.stringify(data, null, space), 'utf8')
    await rename(tmpPath, filePath)
}

/**
 * A list kept under `key` in a JSON file in DATA_DIR. Updates are serialized
 * read-modify-write. A file that exists but cannot be read throws instead of
 * counting as empty, so an update never overwrites it with an empty list.
 */
export function createListStore(fileName, key) {
    const filePath = dataPath(fileName)
    let writeQueue = Promise.resolve()

    async function read() {
        let raw
        try {
            raw = await readFile(filePath, 'utf8')
        } catch (error) {
            if (error.code === 'ENOENT') return []
            throw error
        }
        const list = JSON.parse(raw)?.[key]
        if (!Array.isArray(list)) throw new Error(`${filePath} has no "${key}" list`)
        return list
    }

    function update(mutator) {
        const task = writeQueue.then(async () => {
            const list = await read()
            const result = await mutator(list)
            await writeJsonFile(filePath, { [key]: list }, 2)
            return result
        })
        // Keep the queue alive even if this task fails
        writeQueue = task.catch(() => {})
        return task
    }

    return { read, update }
}
