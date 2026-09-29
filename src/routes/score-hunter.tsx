import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/score-hunter")({
  component: () => <Outlet />,
});
