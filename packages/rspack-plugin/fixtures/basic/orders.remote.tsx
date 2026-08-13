type FileRouteOptions = {
  component: () => null
}

type FileRoute = {
  path: string
  options: FileRouteOptions
}

function createFileRoute(path: string) {
  return (options: FileRouteOptions): FileRoute => ({ path, options })
}

export const Route = createFileRoute('/orders')({
  component: () => null,
})
