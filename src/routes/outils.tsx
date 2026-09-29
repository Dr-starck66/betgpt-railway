import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/outils")({
  component: () => <Outlet />,
});
