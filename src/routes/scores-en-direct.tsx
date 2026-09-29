import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/scores-en-direct")({
  component: () => <Outlet />,
});
