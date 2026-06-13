import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface StoredDoc {
  owner: string
  file: string
}

export interface DocStore {
  load(owner: string, file: string): Promise<Uint8Array | null>
  save(owner: string, file: string, data: Uint8Array): Promise<void>
  list(): Promise<StoredDoc[]>
}

const EXT = '.bin'

/**
 * Persists one document per (owner, file) as a binary Yjs snapshot.
 * Names are URL-encoded so arbitrary owners/filenames are filesystem-safe.
 */
export function createFileDocStore(rootDir: string): DocStore {
  const ownerDir = (owner: string) => join(rootDir, encodeURIComponent(owner))
  const filePath = (owner: string, file: string) =>
    join(ownerDir(owner), `${encodeURIComponent(file)}${EXT}`)

  return {
    async load(owner, file) {
      try {
        return new Uint8Array(await readFile(filePath(owner, file)))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw error
      }
    },

    async save(owner, file, data) {
      await mkdir(ownerDir(owner), { recursive: true })
      await writeFile(filePath(owner, file), data)
    },

    async list() {
      let owners: string[]
      try {
        owners = await readdir(rootDir)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw error
      }

      const docs: StoredDoc[] = []
      for (const encodedOwner of owners) {
        let files: string[]
        try {
          files = await readdir(join(rootDir, encodedOwner))
        } catch {
          continue
        }
        for (const name of files) {
          if (!name.endsWith(EXT)) continue
          docs.push({
            owner: decodeURIComponent(encodedOwner),
            file: decodeURIComponent(name.slice(0, -EXT.length)),
          })
        }
      }
      return docs
    },
  }
}
