'use client'

import { useRouter } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react'
import { deleteProject, revalidateProjects } from '@/app/admin/actions'
import { useToast } from './studio-toaster'

/**
 * Owns the delete, and owns it HERE — in the studio layout — rather than in
 * the editor that asks for one.
 *
 * A delete takes 15-20 seconds against Contentful: every shot, every asset and
 * then the entry, each its own round trip. The editor is a page you can leave
 * inside that window, and two earlier designs both lost the result when you
 * did:
 *
 *   - The action owned by ProjectEditor. Leaving unmounted the component
 *     holding `useActionState`, and React discards a pending action whose
 *     owner is gone. Contentful still destroyed the project — the request was
 *     already in flight — but the outcome was thrown away.
 *   - The action ending in `redirect()`. A redirect is a navigation, and it
 *     loses to one the user starts. Verified: click Back 1.5s in and the
 *     redirect never lands, so no message is ever shown.
 *
 * The layout does not unmount when you move between /admin and
 * /admin/projects/[id] — both are inside it — so a transition started here
 * outlives the page that asked for it, and the report always arrives.
 *
 * Navigation is a consequence, not the mechanism: it happens only if you are
 * still standing on the page whose project just stopped existing.
 */

type DeleteProjectContextValue = {
  /** Starts a delete. Returns immediately — the outcome arrives as a toast. */
  requestDelete: (id: string) => void
  /** The project currently being deleted, so its editor can say so. */
  deletingId?: string
}

const DeleteProjectContext = createContext<DeleteProjectContextValue | null>(null)

export function useDeleteProject(): DeleteProjectContextValue {
  const value = useContext(DeleteProjectContext)
  if (!value) throw new Error('useDeleteProject must be used inside <DeleteProjectProvider>.')
  return value
}

const BOARD = '/admin'

const DeleteProjectProvider = ({ children }: { children: ReactNode }) => {
  const [, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string>()
  const { toast } = useToast()
  const router = useRouter()

  const requestDelete = useCallback(
    (id: string) => {
      setDeletingId(id)

      startTransition(async () => {
        const result = await deleteProject(id)
        setDeletingId(undefined)

        // Nothing was destroyed. Stay put and say why.
        if (result.error) {
          toast(result.error, 'danger')
          return
        }

        /* Leave the dead page, and ONLY the dead page. Read from
           `window.location` at this moment rather than from a `usePathname()`
           captured when the delete started — those are 15-20 seconds apart,
           and the whole point of doing this in the layout is that you are free
           to move in between. A pathname closed over at dispatch would still
           say "the deleted project's editor" long after you had opened a
           different one, and would then navigate you out of it. */
        if (window.location.pathname === `${BOARD}/projects/${id}`) router.replace(BOARD)

        // A warning means it went but left something behind, which is worth
        // reading properly, so it does not expire on its own.
        if (result.warning) toast(result.warning, 'danger')
        else toast(`“${result.deletedTitle ?? 'Project'}” deleted.`)

        // Last, once nothing is rendering the thing that just went. See the
        // note on revalidateProjects.
        await revalidateProjects()
      })
    },
    [router, toast],
  )

  const value = useMemo(() => ({ requestDelete, deletingId }), [requestDelete, deletingId])

  return (
    <DeleteProjectContext.Provider value={value}>{children}</DeleteProjectContext.Provider>
  )
}

export default DeleteProjectProvider
