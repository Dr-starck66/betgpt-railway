import { defineEventHandler, getRequestURL } from "h3";
import { handleGoRequest } from "../../src/lib/go.server";

export default defineEventHandler(async (event) => {
  return handleGoRequest(new Request(getRequestURL(event)));
});
