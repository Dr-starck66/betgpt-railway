import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pronostics-football")({
  component: () => <Outlet />,
});
