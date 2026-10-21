import type { UserSignupEvent, UserModifiedEvent, UserDeletedEvent } from '@netlify/functions'
import { eq } from 'drizzle-orm'
import { database } from '../../db/index.js'
import { members } from '../../db/schema.js'
async function save(event: UserSignupEvent | UserModifiedEvent) {
  const name = String(event.user.userMetadata?.full_name || event.user.userMetadata?.name || event.user.name || 'สมาชิก').slice(0, 100)
  await database().insert(members).values({ id: event.user.id, name }).onConflictDoUpdate({ target: members.id, set: { name } })
  return undefined
}
export default {
  userSignup: save,
  userModified: save,
  async userDeleted(event: UserDeletedEvent) { await database().delete(members).where(eq(members.id, event.user.id)) },
}
